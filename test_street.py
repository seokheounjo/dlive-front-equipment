import json, subprocess

def post(endpoint, params):
    r = subprocess.run(['curl', '-s', '--max-time', '15', '-X', 'POST',
        'http://localhost:8080/api' + endpoint,
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(params)],
        capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except:
        return {'error': r.stdout[:200]}

print('=== 도로명주소 검색 API 테스트 ===')
print()

tests = [
    ('STREET_NM=사당로', {'STREET_NM': '사당로'}),
    ('STREET_NM=사당로 SO_ID=600', {'STREET_NM': '사당로', 'SO_ID': '600'}),
    ('STREET_NM=동작대로', {'STREET_NM': '동작대로'}),
    ('STREET_NM=강남대로', {'STREET_NM': '강남대로'}),
    ('NM_MID=동작구', {'NM_MID': '동작구'}),
    ('NM_SMALL=사당1동', {'NM_SMALL': '사당1동'}),
    ('SO_ID=600 only', {'SO_ID': '600', 'MST_SO_ID': '200'}),
    ('BUILD_NM=쌍립빌딩', {'BUILD_NM': '쌍립빌딩'}),
]

for label, params in tests:
    resp = post('/customer/common/customercommon/getStreetAddrList', params)
    if isinstance(resp, dict):
        code = resp.get('code', '')
        data = resp.get('data', [])
        err = resp.get('error', '')
        if err:
            print(label + ': ERROR - ' + err[:80])
        elif isinstance(data, list):
            count = len(data)
            print(label + ': ' + str(count) + '건 (code=' + code + ')')
            for d in data[:2]:
                addr = d.get('STREET_ADDR', '')
                so = d.get('SO_NM', '')
                gu = d.get('GUGUN_NM', '')
                print('  ' + addr + ' | SO_NM=' + so + ' | ' + gu)
        else:
            print(label + ': code=' + code)
    print()

# Compare with getPostList which works
print('--- 비교: getPostList (작동확인) ---')
resp = post('/statistics/customer/getPostList', {'SO_ID': '600', 'MST_SO_ID': '200', 'USE_FLAG': 'Y'})
if isinstance(resp, dict):
    data = resp.get('data', [])
    if isinstance(data, list):
        print('getPostList SO_ID=600: ' + str(len(data)) + '건')

print()

# Check backend debug logs
r = subprocess.run(['bash', '-c',
    'grep "getStreetAddrList" /home/ubuntu/.pm2/logs/dlive-equipment-out.log 2>/dev/null | tail -8'],
    capture_output=True, text=True)
if r.stdout.strip():
    print('--- PM2 출력 로그 ---')
    for line in r.stdout.strip().split('\n')[-5:]:
        clean = line.replace('0|dlive-eq | ', '')
        print('  ' + clean[:150])

r2 = subprocess.run(['bash', '-c',
    'grep "getStreetAddrList" /home/ubuntu/.pm2/logs/dlive-equipment-error.log 2>/dev/null | tail -5'],
    capture_output=True, text=True)
if r2.stdout.strip():
    print('--- PM2 에러 로그 ---')
    for line in r2.stdout.strip().split('\n')[-3:]:
        clean = line.replace('0|dlive-eq | ', '')
        print('  ' + clean[:150])
