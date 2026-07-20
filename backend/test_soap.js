const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetNamaMhs xmlns="http://kpftiservice.org/">
      <nim>672021111</nim>
      <useracc>siakad</useracc>
      <pwd>siakadftiyes</pwd>
    </GetNamaMhs>
  </soap:Body>
</soap:Envelope>`;

fetch('http://192.168.229.196/kpservicefti/Service.asmx', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"http://kpftiservice.org/GetNamaMhs"'
  },
  body: xmlBody
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
