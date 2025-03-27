const axios = require("axios"); axios.get("http://localhost:3001/api/vehicles").then(res => console.log(res.data)).catch(err => console.error(err.message));
