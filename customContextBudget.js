const { truncateForCompaction, outputToText } = require('./responsesRequestAdapter.js');

const COMPACTION_TOOL_OUTPUT_CHARS = 12000;
// Custom Responses providers can legitimately receive larger image-rich histories than
// Cloud Code. This is only a bounded ingress allowance; the forwarded request is reduced
// back below the normal safety budget before it leaves the local gateway.
const MAX_CUSTOM_ENCODED_REQUEST_BYTES = 64 * 1024 * 1024;
const CUSTOM_CONTEXT_TARGET_BYTES = 24 * 1024 * 1024;
const CUSTOM_CONTEXT_FORWARD_LIMIT_BYTES = 30 * 1024 * 1024;
const OMITTED_HISTORICAL_IMAGE_TEXT = '[Earlier image omitted by the local gateway to keep this long custom-provider conversation within the request-size limit. Preserve the surrounding text and use the most recent images for visual details.]';

function requestBodyBytes(body) {
  return Buffer.byteLength(JSON.stringify(body || {}), 'utf8');
}

function isInlineInputImage(part) {
  return Boolean(part && part.type === 'input_image' && typeof part.image_url === 'string'
    && /^data:[^;,]+;base64,/i.test(part.image_url));
}

function replaceContentPart(input, itemIndex, partIndex, replacement) {
  const original = input[itemIndex];
  const content = Array.isArray(original && original.content) ? original.content.slice() : [];
  content[partIndex] = replacement;
  input[itemIndex] = { ...original, content };
}

function optimizeCustomRequestBody(body, options = {}) {
  const targetBytes = Math.max(1024, Number(options.targetBytes) || CUSTOM_CONTEXT_TARGET_BYTES);
  const forwardLimitBytes = Math.max(targetBytes, Number(options.forwardLimitBytes) || CUSTOM_CONTEXT_FORWARD_LIMIT_BYTES);
  const beforeBytes = requestBodyBytes(body);
  const report = {
    beforeBytes,
    afterBytes: beforeBytes,
    omittedHistoricalImages: 0,
    truncatedHistoricalToolOutputs: 0,
    changed: false,
    requiresUserAction: beforeBytes > forwardLimitBytes
  };
  if (!body || !Array.isArray(body.input) || beforeBytes <= targetBytes) return { body, report };

  const input = body.input.slice();
  const nextBody = { ...body, input };
  let estimatedBytes = beforeBytes;
  let latestImageMessageIndex = -1;
  let latestToolOutputIndex = -1;
  const imageCandidates = [];
  const toolCandidates = [];

  for (let itemIndex = 0; itemIndex < input.length; itemIndex += 1) {
    const item = input[itemIndex];
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'message' || item.role) {
      const content = Array.isArray(item.content) ? item.content : [];
      if (content.some(isInlineInputImage)) latestImageMessageIndex = itemIndex;
    }
    if (['function_call_output', 'custom_tool_call_output'].includes(item.type)) latestToolOutputIndex = itemIndex;
  }

  for (let itemIndex = 0; itemIndex < input.length; itemIndex += 1) {
    const item = input[itemIndex];
    if (!item || typeof item !== 'object') continue;
    if ((item.type === 'message' || item.role) && itemIndex !== latestImageMessageIndex) {
      const content = Array.isArray(item.content) ? item.content : [];
      content.forEach((part, partIndex) => {
        if (isInlineInputImage(part)) imageCandidates.push({ itemIndex, partIndex, part });
      });
    }
    if (['function_call_output', 'custom_tool_call_output'].includes(item.type) && itemIndex !== latestToolOutputIndex) {
      toolCandidates.push({ itemIndex, item });
    }
  }

  for (const candidate of imageCandidates) {
    if (estimatedBytes <= targetBytes) break;
    const replacement = { type: 'input_text', text: OMITTED_HISTORICAL_IMAGE_TEXT };
    const savedBytes = Math.max(0, requestBodyBytes(candidate.part) - requestBodyBytes(replacement));
    replaceContentPart(input, candidate.itemIndex, candidate.partIndex, replacement);
    estimatedBytes -= savedBytes;
    report.omittedHistoricalImages += 1;
  }

  for (const candidate of toolCandidates) {
    if (estimatedBytes <= targetBytes) break;
    const originalText = outputToText(candidate.item.output);
    const truncated = truncateForCompaction(originalText, COMPACTION_TOOL_OUTPUT_CHARS);
    if (truncated === originalText) continue;
    const replacement = { ...input[candidate.itemIndex], output: truncated };
    const savedBytes = Math.max(0, requestBodyBytes(candidate.item) - requestBodyBytes(replacement));
    input[candidate.itemIndex] = replacement;
    estimatedBytes -= savedBytes;
    report.truncatedHistoricalToolOutputs += 1;
  }

  report.afterBytes = requestBodyBytes(nextBody);
  report.changed = report.omittedHistoricalImages > 0 || report.truncatedHistoricalToolOutputs > 0;
  report.requiresUserAction = report.afterBytes > forwardLimitBytes;
  return { body: report.changed ? nextBody : body, report };
}

function responsesRequestReadLimit(customActive) {
  return customActive ? MAX_CUSTOM_ENCODED_REQUEST_BYTES : undefined;
}

module.exports = {
  MAX_CUSTOM_ENCODED_REQUEST_BYTES,
  CUSTOM_CONTEXT_TARGET_BYTES,
  CUSTOM_CONTEXT_FORWARD_LIMIT_BYTES,
  optimizeCustomRequestBody,
  responsesRequestReadLimit
};
