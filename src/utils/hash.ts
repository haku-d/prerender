import * as crypto from "crypto";

const secret = process.env["HASH_SECRET"] || "UGwaVbCxxtgPHZ@XBHTff3Y*@aVvKhJU";

export const md5 = (val: string, useSecretKey = false): string => {
  if (useSecretKey)
    return crypto.createHmac("md5", secret).update(val).digest("hex");
  return crypto.createHash("md5").update(val).digest("hex");
};
