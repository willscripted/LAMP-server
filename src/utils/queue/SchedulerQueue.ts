import Bull from "bull"
import fetch from "node-fetch"
import { ActivityScheduler } from "../../utils/ActivitySchedulerJob"

//Initialise Scheduler Queue
export const SchedulerQueue = new Bull("Scheduler", process.env.REDIS_HOST ?? "")

//Consume job from Scheduler
SchedulerQueue.process(async (job) => {
  console.log("jobs in queue")
  const data: any = job.data
  for (const device of data.participants) {
    const device_type = device.device_type
    const device_token = device.device_token
    const participant_id = device.participant_id
    if (undefined !== device_token && undefined !== device_type && undefined !== participant_id) {
      sendNotification(device_token, device_type, {
        participant_id: participant_id,
        activity_id: data.activity_id,
        message: data.message,
        title: data.title,
      })
    }
  }
  //listen to the competed event of Scheduler Queue
  SchedulerQueue.on("completed", async (job) => {
    ActivityScheduler(job.data.activity_id)
  })
})

/// Send to device with payload and device token given.
function sendNotification(device_token: string, device_type: string, payload: any): void {
  console.dir({ device_token, device_type, payload })
  // Send this specific page URL to the device to show the actual activity.
  // eslint-disable-next-line prettier/prettier
  const url = `${process.env.DASHBOARD_URL}/participant/${payload.participant_id}/activity/${payload.activity_id}`

  switch (device_type) {
    case "android.watch":
    case "android":
      try {
        const opts: any = {
          push_type: "gcm",
          api_key: `${process.env.PUSH_GATEWAY_APIKEY}`,
          device_token: device_token,
          payload: {
            priority: "high",
            data: {
              title: `${payload.title}`,
              message: `${payload.message}`,
              page: `${url}`,
              notificationId: `${payload.title}`,
              actions: [{ name: "Open App", page: `${process.env.DASHBOARD_URL}` }],
              expiry: 3600000,
            },
          },
        }
        //connect to api gateway and send notifications
        fetch(`${process.env.PUSH_GATEWAY}`, {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status`)
            }
          })
          .catch((e) => {
            console.log("Error encountered sending GCM push notification.")
          })
      } catch (error) {
        console.log(`"Error encountered sending GCM push notification"-${error}`)
      }
      break

    case "ios":
      try {
        //preparing curl request
        const opts: any = {
          push_type: "apns",
          api_key: `${process.env.PUSH_GATEWAY_APIKEY}`,
          device_token: device_token,
          payload: {
            aps: {
              alert: `${payload.message}`,
              badge: 0,
              sound: "default",
              "mutable-content": 1,
              "content-available": 1,
            },
            notificationId: `${payload.title}`,
            expiry: 600000,
            page: `${url}`,
            actions: [{ name: "Open App", page: `${url}` }],
          },
        }
        //connect to api gateway and send notifications
        fetch(`${process.env.PUSH_GATEWAY}`, {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error!`)
            }
          })
          .catch((e) => {
            console.log("Error encountered sending APN push notification.")
          })
      } catch (error) {
        console.log(`"Error encountered sending APN push notification"-${error}`)
      }
      break
    case "ios.watch":
      try {
        //preparing curl request
        const opts: any = {
          push_type: "apns",
          api_key: `${process.env.PUSH_GATEWAY_APIKEY}`,
          device_token: device_token,
          payload: {
            aps: {
              alert: `${payload.message}`,
              badge: 0,
              sound: "default",
              "mutable-content": 1,
              "content-available": 1,
            },
            notificationId: `${payload.title}`,
            expiry: 60000,
            page: `${url}`,
            actions: [{ name: "Open App", page: `${url}` }],
          },
        }
        //connect to api gateway and send notifications
        fetch(`${process.env.PUSH_GATEWAY}`, {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json", "apns-push-type": "background", "apns-priority": "5" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error!`)
            }
          })
          .catch((e) => {
            console.log("Error encountered sending APN push notification.")
          })
      } catch (error) {
        console.log(`"Error encountered sending APN push notification"-${error}`)
      }
      break
    default:
      break
  }
}
