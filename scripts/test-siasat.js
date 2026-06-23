// test-soap.js
import readline from 'readline';

async function getNamaMahasiswa(nim) {
  const url = "http://10.10.1.52/kpftiservice/kpservice.asmx";
  
  // 1. XML Body untuk mengambil NAMA
  const xmlBodyNama = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetNamaMhs xmlns="http://kpftiservice.org/">
      <nim>${nim}</nim>
      <useracc>FTIKP</useracc>
      <pwd>234rtegd</pwd>
    </GetNamaMhs>
  </soap:Body>
</soap:Envelope>`;

  // 2. XML Body untuk mengambil DETAIL (TTL, dll)
  const xmlBodyData = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getData xmlns="http://kpftiservice.org/">
      <nim>${nim}</nim>
      <useracc>FTIKP</useracc>
      <pwd>234rtegd</pwd>
    </getData>
  </soap:Body>
</soap:Envelope>`;

  try {
    const responseNama = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": '"http://kpftiservice.org/GetNamaMhs"'
      },
      body: xmlBodyNama
    });

    const responseData = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": '"http://kpftiservice.org/getData"'
      },
      body: xmlBodyData
    });

    if (!responseNama.ok || !responseData.ok) {
      throw new Error(`HTTP Error!`);
    }

    // Dapatkan raw XML dari kedua balasan
    const xmlNama = await responseNama.text();
    const xmlData = await responseData.text();
    
    const extractedData = {};
    const regex = /<([a-zA-Z0-9_]+)(?:\s+[^>]*?)?>([^<]+)<\/\1>/g;
    let match;
    
    // Ekstrak XML NAMA
    while ((match = regex.exec(xmlNama)) !== null) {
      extractedData[match[1]] = match[2].trim();
    }

    // Ekstrak XML DATA
    while ((match = regex.exec(xmlData)) !== null) {
      extractedData[match[1]] = match[2].trim();
    }
    
    console.log("\n=== Results ===");
    if (Object.keys(extractedData).length > 0) {
      const nama = extractedData.nama || extractedData.namamhs || '-';
      const tmplahir = extractedData.kotasal || extractedData.kotalahir || extractedData.tmplahir || '-';
      const tgllahir = extractedData.tgllahir || extractedData.tgl_lahir || '-';
      const progdi = extractedData.progdi || extractedData.namaprogdi || '-';

      console.log(`Nama           : ${nama}`);
      console.log(`TTL            : ${tmplahir}, ${tgllahir}`);
      console.log(`Program Studi  : ${progdi}`);
      
      console.log("\nAll Data (JSON):", extractedData);
    } else {
      console.log("Data not found.");
    }

  } catch (error) {
    console.error("\n[!] Terjadi kesalahan koneksi:", error.message);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Input NIM: ', async (nim) => {
  await getNamaMahasiswa(nim.trim());
  rl.close();
});
