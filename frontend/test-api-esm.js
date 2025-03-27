import axios from "axios"; (async () => { try { const res = await axios.get("http://localhost:3001/api/vehicles"); console.log(res.data); } catch (err) { console.error(err.message); } })();
