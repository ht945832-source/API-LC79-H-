services:
  - type: web
    name: tele68-taixiu-api
    runtime: node
    repo: https://github.com/tranhoang2286/tele68-taixiu-api  # thay bằng repo mày
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: PORT
        value: 5000
      - key: NODE_VERSION
        value: 18.18.0
    healthCheckPath: /
    autoDeploy: true
    domains:
      - tele68-api.onrender.com