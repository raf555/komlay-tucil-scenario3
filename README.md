# komlay-tucil-scenario3
Scenario 3 integration pake Kafka

## flow

1. Kong -> Producer -> Kafka -> Consumer -> Hospital API
2. Consumer -> Kafka -> Producer

## how to run

1. `npm install`
2. `node producer`
3. `node consumer-grand-oak`
4. `node consumer-pine-valley`

## Producer Routes

### `POST /doctors`

#### Request Body

```json
{
    "doctorType": "string"
}
```

#### Response

```json
{
    "result": "success",
    "data": null,
    "error": null
}
```

### `GET /doctors/:doctorType`

#### Request Params

```json
{
    "doctorType": "string"
}
```

#### Response

```json
{
    "result": "success",
    "data": {
        "doctorType": "doctorType",
        "doctors": [
            [],
            []
        ],
        "lastFinishedRequest": "long"
    },
    "error": null
}
```