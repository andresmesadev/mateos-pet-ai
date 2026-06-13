const cron = require("node-cron");



const {

  getAppointmentsForReminder,

  getUpcomingVaccineReminders,

  getUpcomingGroomingReminders,

  sendReminder,

  sendVaccineReminder,

  sendGroomingReminder,

  markReminderSent,

  markVaccineReminderSent,

  markGroomingReminderSent,

} = require("../services/reminder.service");

const { TIMEZONE } = require("../lib/timezone");



const CRON_EXPRESSION = "0 9 * * *";



const processReminders = async () => {

  console.log("[ReminderJob] Running daily reminder job");



  const appointments = await getAppointmentsForReminder();

  let appointmentSentCount = 0;



  for (const appointment of appointments) {

    try {

      const sent = await sendReminder(appointment);



      if (sent) {

        await markReminderSent(appointment.id);

        appointmentSentCount += 1;

      }

    } catch (error) {

      console.error(

        "[ReminderJob] Error processing appointment:",

        appointment.id,

        error.message

      );

    }

  }



  const vaccineRecords = await getUpcomingVaccineReminders();

  let vaccineSentCount = 0;



  for (const record of vaccineRecords) {

    try {

      const sent = await sendVaccineReminder(record, record.pet.owner);



      if (sent) {

        await markVaccineReminderSent(record.id);

        vaccineSentCount += 1;

      }

    } catch (error) {

      console.error(

        "[ReminderJob] Error processing vaccine reminder:",

        record.id,

        error.message

      );

    }

  }



  const groomingReminders = await getUpcomingGroomingReminders();

  let groomingSentCount = 0;



  for (const reminder of groomingReminders) {

    try {

      const sent = await sendGroomingReminder(reminder);



      if (sent) {

        await markGroomingReminderSent(reminder.pet.id);

        groomingSentCount += 1;

      }

    } catch (error) {

      console.error(

        "[ReminderJob] Error processing grooming reminder:",

        reminder.pet.id,

        error.message

      );

    }

  }



  console.log(

    `[ReminderJob] Appointment reminders sent: ${appointmentSentCount}/${appointments.length}`

  );

  console.log(

    `[ReminderJob] Vaccine reminders sent: ${vaccineSentCount}/${vaccineRecords.length}`

  );

  console.log(

    `[ReminderJob] Grooming reminders sent: ${groomingSentCount}/${groomingReminders.length}`

  );



  return {

    appointments: {

      total: appointments.length,

      sent: appointmentSentCount,

    },

    vaccines: {

      total: vaccineRecords.length,

      sent: vaccineSentCount,

    },

    grooming: {

      total: groomingReminders.length,

      sent: groomingSentCount,

    },

  };

};



const startReminderJob = () => {

  cron.schedule(

    CRON_EXPRESSION,

    () => {

      processReminders().catch((error) => {

        console.error("[ReminderJob] Unhandled error:", error.message);

      });

    },

    {

      timezone: TIMEZONE,

    }

  );



  console.log(

    `[ReminderJob] Scheduled daily at 9:00 AM (${TIMEZONE})`

  );

};



module.exports = {

  startReminderJob,

  processReminders,

};


