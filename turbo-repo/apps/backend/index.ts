import { prisma } from "db/client";
import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());
app.use(express.json());

// app.use("/api/v1", );

app.get("/hello", (req, res) => {
  res.send("Hi There");
});

app.listen(4000, () => {
  console.log("server running on port 3000");
});
