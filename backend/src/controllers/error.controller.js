const triggerError = (req, res, next) => {
  const error = new Error("Ruta de prueba de errores");
  next(error);
};

module.exports = {
  triggerError,
};
