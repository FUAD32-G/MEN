const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/applicationController");
const auth = require("../middleware/authMiddleware");

// 🔥 IMPORTANT ORDER
router.get("/timeline/:id", auth, ctrl.getTimeline);
router.get("/:id", auth, ctrl.getOne);
router.get("/", auth, ctrl.getAll);
router.get("/files/:id", auth, ctrl.getFiles);

router.post("/", auth, ctrl.apply);
router.put("/:id", auth, ctrl.update);

module.exports = router;
router.get("/timeline/:id", auth, ctrl.getTimeline);
router.get("/:id", auth, ctrl.getOne);