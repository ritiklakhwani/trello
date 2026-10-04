import cors from "cors";
import express from "express";
import { authRouter } from "./src/routes/auth";
import { router } from "./src/routes/routes";

const PORT = Number(process.env.PORT ?? 3001)

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1", authRouter);
app.use("/api/v1", router);

app.get("/hello", (req, res) => {
  res.send("Hi There");
});

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
