const PRE_ACCEPT_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'ETIMEDOUT'
]);

function errorCode(error) {
  return String(error && (error.code || error.cause && error.cause.code) || '').toUpperCase();
}

function isPreAcceptanceConnectionFailure(error) {
  const code = errorCode(error);
  if (PRE_ACCEPT_ERROR_CODES.has(code)) return true;
  const message = String(error && error.message || error || '');
  return /ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|connect(?:ion)? timed out before headers/i.test(message);
}

function canRetryGeneration(options = {}) {
  if (options.signalAborted || options.responseHeadersReceived || options.firstByteReceived || options.outputStarted) return false;
  if (options.responseStatus !== undefined && options.responseStatus !== null) return false;
  return isPreAcceptanceConnectionFailure(options.error);
}

function retryDiagnostic(options = {}) {
  return {
    attempt: Number(options.attempt) || 1,
    retryReason: String(options.retryReason || options.error && options.error.message || ''),
    responseHeadersReceived: Boolean(options.responseHeadersReceived),
    firstByteReceived: Boolean(options.firstByteReceived),
    outputStarted: Boolean(options.outputStarted),
    toolCallStarted: Boolean(options.toolCallStarted)
  };
}

module.exports = {
  PRE_ACCEPT_ERROR_CODES,
  errorCode,
  isPreAcceptanceConnectionFailure,
  canRetryGeneration,
  retryDiagnostic
};
