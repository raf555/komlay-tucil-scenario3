const { Kafka } = require('kafkajs');
const axios = require('axios').default || require('axios');

async function main() {
    const kafka = new Kafka({
        brokers: ["localhost:9092"]
    });

    const consumer = kafka.consumer({
        groupId: "pine-valley-consumer-group"
    });
    const producer = kafka.producer();

    await Promise.all([consumer.connect(), producer.connect()])
        .then(() => console.log("Connected as consumer and producer"));

    handleIncomingMessage(consumer, producer);
}

/**
 * 
 * @param {import('kafkajs/types').Consumer} consumer 
 * @param {import('kafkajs/types').Producer} producer 
 */
async function handleIncomingMessage(consumer, producer) {
    await consumer.subscribe({ topic: "doctors-request", fromBeginning: true });
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                let msg = JSON.parse(message.value.toString());
                if (!msg.doctorType) throw new Error("Invalid doctorType");
                findDoctors(msg.doctorType, producer);
            } catch (e) {
                console.error("Error when handling incoming message:" + e.message)
            }
        },
    })
}

/**
 * 
 * @param {string} doctorType 
 * @param {import('kafkajs/types').Producer} producer 
 */
async function findDoctors(doctorType, producer) {
    try {
        let res = await axios.post("http://localhost:9091/pineValley/doctors", {
            doctorType: doctorType
        }).then(res => res.data).catch(() => {
            return {
                "doctors": {
                    "doctor": []
                }
            }
        });
        await producer.send({
            topic: "pine-valley-result",
            messages: [
                { key: doctorType, value: JSON.stringify(res) }
            ]
        });
        console.log("Succesfully push message pine-valley doctors " + doctorType);
    } catch (e) {
        console.error("Error when fetching/producing doctors data: " + e.message);
    }
}

main();
