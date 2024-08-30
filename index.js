if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const API_USER = process.env.API_USER || null;
if (!API_USER) {
  console.log(`No API_USER found`);
  process.exit(0);
}

const API_PW = process.env.API_PW || null;
if (!API_PW) {
  console.log(`No JWT API_PW found`);
  process.exit(0);
}

const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const axios = require("axios");
const cors = require("cors");

const { authFlow } = require("./authFlow");
const VehicleMapping = require("./mapping.json").Vehicle;
const CustomerMapping = require("./mapping.json").Customer;

const PORT = 3333;

const ELASTIC_URL = process.env.ELASTIC_URL || null;
if (!ELASTIC_URL) {
  console.log(`No Elastic-URL found`);
  process.exit(0);
}
const CarsIndex = `${ELASTIC_URL}/cars/_search`;
const CustomerIndex = `${ELASTIC_URL}/customers/_search`;

const app = express();

const requestBody = (q, mapping) => {
  let fields = Object.values(mapping).filter((x) => !!x);
  return {
    query: {
      multi_match: {
        query: q,
        fields,
        fuzziness: "AUTO",
        type: "best_fields",
      },
    },
  };
};

app.use(morgan("[:date] :method :url :status - :response-time ms"));
app.use(cors());
app.use(bodyParser.json());

app.use(authFlow);

app.get("/ping", (req, res) => res.send(`PONG!`));

app.get("/customers", (req, res) => {
  try {
    let search = req.query.search;
    if (!search) {
      res.status(400).json({
        success: false,
        message: "no search value in query params found",
        hits: [],
      });
    }
    let body = requestBody(search, CustomerMapping);
    axios.post(CustomerIndex, body).then((response) => {
      if (response.status !== 200)
        throw `Database server responded with status code ${response.status}`;
      let dt = response.data;
      let hits = dt.hits.hits;
      if (!Array.isArray(hits)) throw `hits is not an array`;

      hits = hits
        .map((x) => x._source)
        .filter((x) => !!x.nachname)
        .map((x) => {
          let ret = {};
          for (let k of Object.keys(CustomerMapping)) {
            ret[k] = x[CustomerMapping[k]] ? x[CustomerMapping[k]] : null;
          }
          ret.id = ret.reference_id;
          return ret;
        });

      let status = 200;
      if (hits.length === 0) status = 404;

      res.status(status).json({
        success: true,
        hits,
      });
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "internal server error",
      error: err,
      hits: [],
    });
  }
});
app.get("/vehicles", (req, res) => {
  try {
    let search = req.query.search;
    if (!search) {
      res.status(400).json({
        success: false,
        message: "no search value in query params found",
        hits: [],
      });
    }
    let body = requestBody(search, VehicleMapping);
    axios.post(CarsIndex, body).then((response) => {
      if (response.status !== 200)
        throw `Database server responded with status code ${response.status}`;
      let dt = response.data;
      let hits = dt.hits.hits;
      if (!Array.isArray(hits)) throw `hits is not an array`;

      hits = hits
        .map((x) => x._source)
        .map((x) => {
          let ret = {};
          for (let k of Object.keys(VehicleMapping)) {
            ret[k] = x[VehicleMapping[k]] ? x[VehicleMapping[k]] : null;
          }
          ret.registration_date = x.erstzulassung ? x.erstzulassung : null;
          ret.id = new Date(x.fzg_id).getTime();
          return ret;
        });
      let status = 200;
      if (hits.length === 0) status = 404;
      res.status(status).json({
        success: true,
        hits,
      });
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: "internal server error",
      error: err,
      hits: [],
    });
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
