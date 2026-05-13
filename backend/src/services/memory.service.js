const sessions = {};

const getSession = (phone) => {
  return sessions[phone] || {};
};

const updateSession = (phone, data) => {
  const current = sessions[phone] || {};
  sessions[phone] = { ...current, ...data };
  return sessions[phone];
};

const clearSession = (phone) => {
  delete sessions[phone];
};

module.exports = {
  getSession,
  updateSession,
  clearSession,
};
