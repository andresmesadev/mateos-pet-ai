const cron = require("node-cron");



const {
  getAppointmentsForReminder,
  getUpcomingVaccineReminders,
  getUpcomingDewormingReminders,
  getUpcomingGroomingReminders,
  getConsultationsForFollowUp,
  sendReminder,
  sendVaccineReminder,
  sendDewormingReminder,
  sendGroomingReminder,
  sendFollowUp,
  markReminderSent,
  markVaccineReminderSent,
  markDewormingReminderSent,
  markGroomingReminderSent,
  markFollowUpSent,
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



  const dewormingRecords = await getUpcomingDewormingReminders();
  let dewormingSentCount = 0;

  for (const record of dewormingRecords) {
    try {
      const sent = await sendDewormingReminder(record);
      if (sent) {
        await markDewormingReminderSent(record.id);
        dewormingSentCount += 1;
      }
    } catch (error) {
      console.error("[ReminderJob] Error processing deworming reminder:", record.id, error.message);
    }
  }

  const groomingReminders = await getUpcomingGroomingReminders();
  let groomingSentCount = 0;

  for (const record of groomingReminders) {
    try {
      const sent = await sendGroomingReminder(record);
      if (sent) {
        await markGroomingReminderSent(record.id);
        groomingSentCount += 1;
      }
    } catch (error) {
      console.error("[ReminderJob] Error processing grooming reminder:", record.id, error.message);
    }
  }



  console.log(

    `[ReminderJob] Appointment reminders sent: ${appointmentSentCount}/${appointments.length}`

  );

  console.log(`[ReminderJob] Vaccine reminders sent: ${vaccineSentCount}/${vaccineRecords.length}`);
  console.log(`[ReminderJob] Deworming reminders sent: ${dewormingSentCount}/${dewormingRecords.length}`);
  console.log(`[ReminderJob] Grooming reminders sent: ${groomingSentCount}/${groomingReminders.length}`);



  const consultations = await getConsultationsForFollowUp();

  let followUpSentCount = 0;



  for (const appointment of consultations) {

    try {

      const sent = await sendFollowUp(appointment);



      if (sent) {

        await markFollowUpSent(appointment.id);

        followUpSentCount += 1;

      }

    } catch (error) {

      console.error(

        "[ReminderJob] Error processing follow-up:",

        appointment.id,

        error.message

      );

    }

  }



  console.log(

    `[ReminderJob] Follow-ups sent: ${followUpSentCount}/${consultations.length}`

  );



  return {

    appointments: {

      total: appointments.length,

      sent: appointmentSentCount,

    },

    vaccines: { total: vaccineRecords.length, sent: vaccineSentCount },
    deworming: { total: dewormingRecords.length, sent: dewormingSentCount },
    grooming: { total: groomingReminders.length, sent: groomingSentCount },

    followUps: {

      total: consultations.length,

      sent: followUpSentCount,

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


