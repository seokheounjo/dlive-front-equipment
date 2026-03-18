const http = require("http");
function makeReq(opts, data) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => resolve({status: res.statusCode, body, cookies: res.headers["set-cookie"]}));
    });
    r.on("error", reject);
    r.setTimeout(30000, () => { r.destroy(); reject(new Error("timeout")); });
    if (data) r.write(data);
    r.end();
  });
}
(async () => {
  // Login
  const loginData = JSON.stringify({USR_ID: "A20117965", PASSWORD: "dlive12!@#$"});
  const login = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/login", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(loginData)}}, loginData);
  const cookie = login.cookies ? login.cookies.map(c => c.split(";")[0]).join("; ") : "";

  const loginParsed = JSON.parse(login.body);
  console.log("Login soId:", loginParsed.soId, "crrId:", loginParsed.crrId, "mstSoId:", loginParsed.mstSoId);

  // Test 1: Empty SO_ID and CRR_ID to remove filters
  const data1 = JSON.stringify({WRKR_ID: "A20117965", SO_ID: "", CRR_ID: ""});
  const res1 = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/customer/equipment/getWrkrHaveEqtList_All", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(data1), "Cookie": cookie}}, data1);
  console.log("\nTest 1 (SO_ID='', CRR_ID=''):", JSON.parse(res1.body).length || 0, "items");
  if (res1.body.length > 2) console.log(res1.body.substring(0, 500));

  // Test 2: No WRKR_ID, empty SO_ID/CRR_ID
  const data2 = JSON.stringify({SO_ID: "", CRR_ID: ""});
  const res2 = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/customer/equipment/getWrkrHaveEqtList_All", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(data2), "Cookie": cookie}}, data2);
  console.log("\nTest 2 (no WRKR_ID, SO_ID=''):", JSON.parse(res2.body).length || 0, "items");
  if (res2.body.length > 2) console.log(res2.body.substring(0, 500));

  // Test 3: SO_ID=206
  const data3 = JSON.stringify({WRKR_ID: "A20117965", SO_ID: "206", CRR_ID: "0009215"});
  const res3 = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/customer/equipment/getWrkrHaveEqtList_All", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(data3), "Cookie": cookie}}, data3);
  console.log("\nTest 3 (SO_ID=206, CRR_ID=0009215):", JSON.parse(res3.body).length || 0, "items");
  if (res3.body.length > 2) console.log(res3.body.substring(0, 500));

  // Test 4: getEquipmentOutList
  const data4 = JSON.stringify({WRKR_ID: "A20117965", FROM_OUT_REQ_DT: "20250101", TO_OUT_REQ_DT: "20260316"});
  const res4 = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/customer/equipment/getEquipmentOutList", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(data4), "Cookie": cookie}}, data4);
  console.log("\nTest 4 (getEquipmentOutList):", JSON.parse(res4.body).length || 0, "items");
  if (res4.body.length > 2) console.log(res4.body.substring(0, 500));

  // Test 5: getEquipmentChkStndByA_All
  const data5 = JSON.stringify({WRKR_ID: "A20117965"});
  const res5 = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/customer/equipment/getEquipmentChkStndByA_All", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(data5), "Cookie": cookie}}, data5);
  console.log("\nTest 5 (getEquipmentChkStndByA_All):", JSON.parse(res5.body).length || 0, "items");
  if (res5.body.length > 2) console.log(res5.body.substring(0, 500));

  // Test 6: getUserExtendedInfo (to get full session info)
  const data6 = JSON.stringify({USR_ID: "A20117965"});
  const res6 = await makeReq({hostname: "58.143.140.222", port: 8080, path: "/api/customer/equipment/getUserExtendedInfo", method: "POST", headers: {"Content-Type": "application/json", "Content-Length": Buffer.byteLength(data6), "Cookie": cookie}}, data6);
  console.log("\nTest 6 (getUserExtendedInfo):");
  console.log(res6.body.substring(0, 1000));
})().catch(e => console.error("Error:", e.message));
