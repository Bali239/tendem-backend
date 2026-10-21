function wrapAsync(handler) {
  return function wrapped(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export default wrapAsync;
