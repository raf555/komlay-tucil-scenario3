const express = require("express");
const cors = require("cors");
const { Kafka } = require("kafkajs");

const app = express();
const port = 8999;

// kafka
const kafka = new Kafka({
    brokers: ["localhost:9092"]
});
const consumer = kafka.consumer({
    groupId: "api-consumer-group"
});
const producer = kafka.producer();

/**
 * 
 * @param {{[doctorType: string]: Array}} resMap
 * @param {(string) => void} finish
 */
async function setupConsumer(resMap, finish) {
    const topics = [
        "pine-valley-result",
        "grand-oak-result"
    ];

    await Promise.all(topics.map(topic => consumer.subscribe({ topic: topic, fromBeginning: true })));
    console.log(`succesfully subscribing to ${topics.length} hospital topic`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                if (!message.key) return;
                let msg = JSON.parse(message.value.toString());
                resMap[message.key.toString().toLowerCase()].push(msg.doctors.doctor);
                if (topics.length === resMap[message.key.toString().toLowerCase()].length) {
                    finish(message.key.toString());
                }
            } catch (e) {
                console.error("Error when handling incoming result:" + e.message)
            }
        },
    });
}

async function setupServer() {
    const result = {};
    const finishedFetching = {};
    const timestampFetch = {};

    // setup consumer to handle result
    await setupConsumer(result, (doctorType) => {
        finishedFetching[doctorType] = true;
        timestampFetch[doctorType] = Date.now();
    });

    // request from anywhere
    app.use(cors());
    app.use(express.json());

    // request doctor type
    app.post("/doctors", async (req, res, next) => {
        try {
            let doctorType = req.body.doctorType;
            if (!doctorType) throw "doctorType can't be empty";

            if (finishedFetching[doctorType.toLowerCase()] === false) {
                throw `request for ${doctorType} is not finished, please try again later`;
            }

            result[doctorType.toLowerCase()] = [];
            finishedFetching[doctorType.toLowerCase()] = false;

            await producer.send({
                topic: "doctors-request",
                messages: [
                    { value: JSON.stringify({ doctorType: doctorType }) }
                ]
            });

            console.log("successfully send message to kafka: " + doctorType);
            res.status(200).send({
                result: "success",
                data: null,
                error: null
            });
        } catch (e) {
            next(e);
        }
    });

    // doctor type result
    app.get("/doctors/:doctorType", (req, res, next) => {
        try {
            let doctorType = req.params.doctorType;
            if (!doctorType) throw "doctorType can't be empty";

            if (!finishedFetching[doctorType.toLowerCase()]) {
                if (finishedFetching[doctorType.toLowerCase()] === undefined) {
                    throw `request for ${doctorType} is not made, please do request at POST /doctors`;
                } else {
                    throw `request for ${doctorType} is not finished yet, please try again later`;
                }
            }

            res.status(200).json({
                result: "success",
                data: {
                    doctorType: doctorType.toLowerCase(),
                    doctors: result[doctorType.toLowerCase()],
                    lastFinishedRequest: timestampFetch[doctorType.toLowerCase()]
                },
                error: null
            });
        } catch (e) {
            next(e);
        }
    });

    // error handler
    app.use((err, req, res, next) => {
        if (typeof err === "string") {
            return res.status(400).json({
                result: "fail",
                data: null,
                error: err
            });
        }

        return res.status(500).json({
            result: "fail",
            data: null,
            error: err.message
        });
    })
}

async function main() {
    // initialize kafka consumer and producer
    await Promise.all([consumer.connect(), producer.connect()])
        .then(() => console.log("Connected as consumer and producer"));

    // initialize routes
    await setupServer();
}

main().then(() => app.listen(port, () => {
    console.info(`Server is listening on ${port}`);
})).catch(e => {
    console.error("Error initializing producer:", e.message)
});
