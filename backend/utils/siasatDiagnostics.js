const getLocalName = (nodeName) => String(nodeName).split(':').pop();

const findXmlNodeEntry = (obj, nodeName) => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return { found: false, value: undefined };
  }

  for (const [key, value] of Object.entries(obj)) {
    if (getLocalName(key) === nodeName) {
      return { found: true, value };
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findXmlNodeEntry(value, nodeName);
      if (found.found) return found;
    }
  }

  return { found: false, value: undefined };
};

const describeNode = ({ found, value }) => {
  if (!found) return { type: 'missing' };
  if (Array.isArray(value)) {
    const firstObject = value.find((item) => item && typeof item === 'object');
    return {
      type: 'array',
      count: value.length,
      itemKeys: firstObject ? Object.keys(firstObject).filter((key) => !key.startsWith('@_')) : [],
    };
  }
  if (value && typeof value === 'object') {
    return {
      type: 'object',
      keys: Object.keys(value).filter((key) => !key.startsWith('@_') && key !== '_text'),
    };
  }

  return {
    type: typeof value,
    isEmpty: value === null || value === undefined || String(value).trim() === '',
    textLength: value === null || value === undefined ? 0 : String(value).length,
  };
};

const collectNodeNames = (obj, names = new Set()) => {
  if (obj === null || obj === undefined || typeof obj !== 'object' || names.size >= 40) {
    return names;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('@_') && key !== '_text') {
      names.add(getLocalName(key));
    }
    if (value && typeof value === 'object') {
      collectNodeNames(value, names);
    }
    if (names.size >= 40) break;
  }

  return names;
};

export const summarizeSoapResponse = ({
  xmlText,
  parsedBody,
  operation,
  resultNodeName,
  dataNodeName,
}) => {
  const operationResponse = findXmlNodeEntry(parsedBody, `${operation}Response`);
  const resultNode = findXmlNodeEntry(parsedBody, resultNodeName);
  const dataNode = findXmlNodeEntry(parsedBody, dataNodeName);
  const soapFault = findXmlNodeEntry(parsedBody, 'Fault');

  return {
    responseBytes: Buffer.byteLength(xmlText || '', 'utf8'),
    hasSoapFault: soapFault.found,
    operationResponsePresent: operationResponse.found,
    resultNode: describeNode(resultNode),
    dataNode: describeNode(dataNode),
    nodeNames: [...collectNodeNames(parsedBody)],
    isEmptySuccessResponse:
      operationResponse.found &&
      !soapFault.found &&
      !resultNode.found &&
      !dataNode.found,
  };
};
