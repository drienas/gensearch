if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { verifyToken } = require("./jwt");

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

const authFlow = (req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).send({
      status: "UNAUTHORIZED",
      message: "No token found",
    });
    return;
  }

  let tsplit = req.headers.authorization.split(" ");

  if (tsplit.length < 2) {
    res.status(401).send({
      status: "UNAUTHORIZED",
      message: "Invalid token",
    });
    return;
  }

  let valid, data;
  const token = tsplit[1];

  switch (tsplit[0]) {
    case "Basic":
      const nToken = Buffer.from(`${API_USER}:${API_PW}`).toString("base64");
      data = null;
      valid = nToken === token;
      break;
    case "Bearer":
    default:
      let v = verifyToken(token);
      valid = v.valid;
      data = v.data;
      break;
  }

  if (!valid) {
    res.status(401).send({
      status: "UNAUTHORIZED",
      message: "Invalid token set",
    });
    return;
  }
  next();
};

module.exports = { authFlow };
