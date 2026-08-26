*** Settings ***
Library    RequestsLibrary
Library    Collections
Library    OperatingSystem
Suite Setup    Wait For Backend And Create Session

*** Variables ***
# Override at the command line for staging/CI, e.g.:
#   robot --variable BASE_URL:http://backend:4000 api_tests.robot
${BASE_URL}             http://localhost:4000
${VALID_FEED_PATH}      ${CURDIR}/sample_feed.json
${HEALTH_TIMEOUT}       30s
${HEALTH_RETRY}         1s

*** Test Cases ***
Get Rules Returns Rule Metadata
    [Documentation]    /api/rules is a GET with no body, defined in routes/validate.js.
    ...    Returns a list of {id, title, description, severity} objects.
    [Tags]    smoke    rules
    ${response}=    GET On Session    api    /api/rules    expected_status=200
    ${rules}=    Set Variable    ${response.json()}
    Should Not Be Empty    ${rules}
    Dictionary Should Contain Key    ${rules}[0]    id
    Dictionary Should Contain Key    ${rules}[0]    severity

Validate Endpoint Accepts A Known-Good Feed
    [Documentation]    /api/validate requires the body wrapped as {"records": [...]},
    ...    NOT a bare array. The bundled sample_feed.json is a raw array on disk,
    ...    so it must be wrapped here before sending.
    [Tags]    smoke    validate
    ${raw_feed}=    Load JSON From File    ${VALID_FEED_PATH}
    ${payload}=    Create Dictionary    records=${raw_feed}
    ${response}=    POST On Session    api    /api/validate    json=${payload}    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    Dictionary Should Contain Key    ${body}    total
    Dictionary Should Contain Key    ${body}    results
    Should Be True    ${body}[total] == len(${raw_feed})

Validate Endpoint Rejects A Record With Missing Title
    [Documentation]    A record with no title should come back with status "rejected"
    ...    and a failure entry with ruleId "missing-title".
    [Tags]    validate
    ${bad_record}=    Create Dictionary    sku=TEST-001    price=19.99    currency=EUR
    ...    category=lighting    imageUrl=https://via.placeholder.com/150
    ${feed}=    Create List    ${bad_record}
    ${payload}=    Create Dictionary    records=${feed}
    ${response}=    POST On Session    api    /api/validate    json=${payload}    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    ${result}=    Set Variable    ${body}[results][0]
    Should Be Equal As Strings    ${result}[status]    rejected
    ${failure_ids}=    Evaluate    [f['ruleId'] for f in $result['failures']]
    List Should Contain Value    ${failure_ids}    missing-title

Validate Endpoint Rejects An Unsupported Currency
    [Documentation]    Checks the invalid-currency rule (allowed set is
    ...    EUR, USD, GBP, SEK, DKK, NOK per quality_engine.js) actually fires.
    [Tags]    validate
    ${bad_record}=    Create Dictionary    sku=TEST-002    title=Test Lamp    price=49.99
    ...    currency=XYZ    category=lighting    imageUrl=https://via.placeholder.com/150
    ${feed}=    Create List    ${bad_record}
    ${payload}=    Create Dictionary    records=${feed}
    ${response}=    POST On Session    api    /api/validate    json=${payload}    expected_status=200
    ${body}=    Set Variable    ${response.json()}
    ${result}=    Set Variable    ${body}[results][0]
    ${failure_ids}=    Evaluate    [f['ruleId'] for f in $result['failures']]
    List Should Contain Value    ${failure_ids}    invalid-currency

Validate Endpoint Rejects Malformed Request Body
    [Documentation]    Sending a bare array instead of {"records": [...]} should
    ...    return 400, per the explicit check in routes/validate.js.
    [Tags]    validate    negative
    ${bad_record}=    Create Dictionary    sku=TEST-003    title=Test    price=10    currency=EUR
    ${bare_array}=    Create List    ${bad_record}
    ${response}=    POST On Session    api    /api/validate    json=${bare_array}    expected_status=400

Validate Endpoint Handles An Empty Feed Gracefully
    [Documentation]    Negative test: sends an empty records list and checks the API
    ...    doesn't crash (no 500).
    [Tags]    validate    negative
    ${empty_feed}=    Create List
    ${payload}=    Create Dictionary    records=${empty_feed}
    ${response}=    POST On Session    api    /api/validate    json=${payload}
    Should Not Be Equal As Integers    ${response.status_code}    500
    Should Be Equal As Integers    ${response.status_code}    200

Ask Endpoint Answers A Grounded Question
    [Documentation]    /api/ask expects {"question": "..."} (routes/ask.js).
    ...    Works with zero configuration / no API key (offline RAG synthesis).
    [Tags]    smoke    ask
    ${payload}=    Create Dictionary    question=Why does an unsupported currency get rejected?
    ${response}=    POST On Session    api    /api/ask    json=${payload}    expected_status=200
    Should Not Be Empty    ${response.json()}

Ask Endpoint Rejects Missing Question Field
    [Documentation]    routes/ask.js explicitly 400s when "question" is missing or not a string.
    [Tags]    ask    negative
    ${payload}=    Create Dictionary    notAQuestion=hello
    ${response}=    POST On Session    api    /api/ask    json=${payload}    expected_status=400

*** Keywords ***
Load JSON From File
    [Arguments]    ${path}
    ${content}=    Get File    ${path}
    ${json}=    Evaluate    json.loads('''${content}''')    json
    RETURN    ${json}

Wait For Backend And Create Session
    [Documentation]    Polls /api/health before the suite starts, so tests fail
    ...    with a clear "backend never came up" message instead of a confusing
    ...    connection-refused error on the very first test case. Useful when
    ...    the backend is still booting (e.g. right after `docker compose up`
    ...    or a freshly started CI service container).
    Create Session    api    ${BASE_URL}
    Wait Until Keyword Succeeds    ${HEALTH_TIMEOUT}    ${HEALTH_RETRY}
    ...    GET On Session    api    /api/health    expected_status=200
