const http = require("http");
const loginData = JSON.stringify({USR_ID: "MOBILE", USR_PW: "cona1234"});
const loginReq = http.request({
  hostname: "58.143.140.222", port: 8080, path: "/api/login",
  method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(loginData) }
}, (loginRes) => {
  let data = "";
  loginRes.on("data", c => data += c);
  loginRes.on("end", () => {
    const cookies = loginRes.headers["set-cookie"] || [];
    let jsessionid = "";
    cookies.forEach(c => { const m = c.match(/JSESSIONID=([^;]+)/); if (m) jsessionid = m[1]; });
    console.log("JSESSIONID:", jsessionid ? jsessionid.substring(0,20) + "..." : "NOT FOUND");
    if (jsessionid.length === 0) return;

    const xmlBody = '<root><dataset id="DS_INPUT"><columninfo><column id="CHECK_TYPE" type="STRING"/><column id="CUST_TP" type="STRING"/><column id="CUST_NM" type="STRING"/><column id="RSDT_CRRNO" type="STRING"/><column id="CARD_ACNT_CD" type="STRING"/><column id="CARD_ACNT_NO" type="STRING"/></columninfo><record><CHECK_TYPE>E</CHECK_TYPE><CUST_TP>A</CUST_TP><CUST_NM>test</CUST_NM><RSDT_CRRNO>8501011234567</RSDT_CRRNO><CARD_ACNT_CD>004</CARD_ACNT_CD><CARD_ACNT_NO>1007353173</CARD_ACNT_NO></record></dataset></root>';
    const postData = Buffer.from(xmlBody);

    const req = http.request({
      hostname: "58.143.140.222", port: 8080,
      path: "/customer/customer/general/addCustomerRlnmAuthCheck.req",
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=euc-kr", "Content-Length": postData.length, "Cookie": "JSESSIONID=" + jsessionid }
    }, (res) => {
      let vdata = "";
      res.on("data", c => vdata += c);
      res.on("end", () => { console.log("Status:", res.statusCode); console.log("Response:", vdata.substring(0, 500)); });
    });
    req.write(postData);
    req.end();
  });
});
loginReq.write(loginData);
loginReq.end();
