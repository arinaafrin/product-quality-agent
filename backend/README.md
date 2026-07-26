# TimeCapsule — Backend (Python / Django)

This is the backend for TimeCapsule. It was moved from **PHP (Laravel)** to
**Python (Django + Django REST Framework)**, using a standard, production-ready
folder layout.

It gives people an API to explore AI-made "time travel" experiences: pick a
city and a year, and the app shows a story and images of what that place may
have looked like back then.

## What this app does

- People can sign up, log in, or sign in with Google.
- People can look at cities and past "experiences" (a city + a year + a
  story).
- Partners and admins can create new experiences and ask the AI to write a
  story or make an image for them (this happens in the background, so the
  app stays fast).
- Admins can check new experiences before they go live (this is called
  "moderation").
- People can save their favorite experiences.
- Partner groups (like museums) can be verified by an admin.
- Several experiences can be grouped into a "Journey" (a themed walking
  tour), each stop reusing the same experience + AI generation pipeline.

## How the project is organized

```
timecapsule/
├── manage.py                  # the main command you run to start/manage the app
├── requirements/               # lists of Python packages the app needs
│   ├── base.txt                 # packages needed everywhere
│   ├── dev.txt                  # + testing and debugging tools (local computer only)
│   └── production.txt           # + tools needed on the live server
├── .env.example                 # example list of secret settings (copy to .env)
├── pytest.ini                   # settings for running automated tests
├── Dockerfile                   # instructions to build the app into a container
├── docker-compose.yml            # starts the app + database + cache on your computer
├── docker-compose.prod.yml       # extra settings used only on the live server
├── gunicorn.conf.py               # settings for the production web server
│
├── config/                      # the app's central control room
│   ├── settings/
│   │   ├── base.py               # settings shared by every environment
│   │   ├── development.py        # settings used on your own computer
│   │   ├── production.py         # settings used on the live server
│   │   └── test.py               # settings used while running tests
│   ├── urls.py                   # the main map of every web address (URL)
│   ├── celery.py                 # sets up background/queued jobs
│   ├── wsgi.py / asgi.py         # how the web server talks to Django
│
├── apps/                        # the actual features, one folder per topic
│   ├── accounts/                  # sign up, log in, Google login, user roles
│   ├── cities/                    # the City model (name, country, map position)
│   ├── experiences/                # the main feature: Experience + MediaAsset + Favorite
│   ├── ai_generation/               # asks the AI to write stories / make images
│   ├── moderation/                  # admin review: approve / reject / comment
│   ├── journeys/                     # a themed group of experiences (a "tour")
│   ├── partners/                     # museums/organizations and their verification
│   └── common/                        # small shared building blocks used by every app
│
├── .github/workflows/ci.yml      # runs checks and tests every time code changes
└── scripts/entrypoint.sh          # waits for the database, then starts the app
```

Each app folder under `apps/` follows the same pattern:

| File             | What it holds                                             |
|-------------------|------------------------------------------------------------|
| `models.py`       | The shape of the data (like a spreadsheet's columns)        |
| `serializers.py`  | Turns that data into JSON for the API, and back             |
| `views.py`        | What happens when someone calls an API address              |
| `urls.py`         | Which address points to which view                          |
| `permissions.py`  | Who is allowed to do what (visitor / partner / admin)       |
| `admin.py`        | Lets staff manage the data from a web page (`/admin`)       |
| `tasks.py`        | Work that runs in the background (only in `ai_generation`)  |
| `tests/`          | Automated checks that make sure the code still works         |

## Getting started (with Docker — recommended)

1. Copy the example settings file:
   ```
   cp .env.example .env
   ```
2. Start everything (web app, database, cache, background worker):
   ```
   docker compose up --build
   ```
3. Open http://localhost:8000/api/v1/ping — you should see `{"status": "ok"}`.
4. Open http://localhost:8000/api/docs — interactive API documentation.

## Getting started (without Docker)

1. Create a virtual environment and install packages:
   ```
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements/dev.txt
   ```
2. Copy `.env.example` to `.env` and point `DATABASE_URL` at your own
   Postgres database.
3. Set up the database tables:
   ```
   python manage.py migrate
   ```
4. Start the app:
   ```
   python manage.py runserver
   ```

## Running tests

```
pytest
```

## Running in production

The live server uses `docker-compose.prod.yml` together with
`docker-compose.yml`:

```
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

This runs the app with Gunicorn (a production-ready web server), turns off
debug mode, and adds security headers.

## Notes on the move from PHP to Python

- Laravel's **Eloquent models** → Django **models**
- Laravel's **Sanctum tokens** → **JWT** access/refresh tokens
  (`djangorestframework-simplejwt`)
- Laravel's **queued Jobs** (`GenerateStoryJob`, `GenerateMediaJob`) →
  **Celery tasks** (`apps/ai_generation/tasks.py`), using Redis as the queue
- Laravel's **Policies** (`ExperiencePolicy`, `JourneyPolicy`) → Django REST
  Framework **permission classes**
- Laravel's `role:partner,admin` route middleware → a small `HasRole`
  permission class in `apps/common/permissions.py`
- Laravel's `ai.rate_limit` middleware → an `AiRateLimitPermission` class
  (kept as a permission, not middleware, because the logged-in user is only
  known once DRF checks the login token — plain Django middleware runs too
  early to see it)
- `config/ai.php` and `config/media.php` → environment variables read in
  `config/settings/base.py` (`AI_STORY_PROVIDER`, `MEDIA_SIGNED_URL_TTL_SECONDS`, etc.)

## What's a stub vs. what's real

Everything about routing, authentication, permissions, data models, and
background jobs is fully wired and tested. The actual calls to the Anthropic
and Stability AI APIs (`apps/ai_generation/providers.py`) are left as clearly
marked stubs — add real API keys and call the real APIs there when you're
ready to go live.
