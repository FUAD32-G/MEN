module.exports = (req, res, next) => {
  try {
    const role = req.user.role;
    const { status } = req.body;

    // rules
    const rules = {
      receptionist: ["Approved"],
      it: ["Medical", "LMIS"],
      secretary: ["Tasheer"],
      executor: ["Ticket"],
      owner: ["Ready"]
    };

    // if no status change, allow
    if (!status) return next();

    const allowedSteps = rules[role];

    if (!allowedSteps || !allowedSteps.includes(status)) {
      return res.status(403).send("You cannot update this step");
    }

    next();
  } catch (error) {
    res.status(500).send("Workflow error");
  }
};