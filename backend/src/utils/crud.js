import express from "express";

function coerceQueryTypes(query) {
  const result = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
      result[key] = Number(value);
    } else if (value === "true" || value === "false") {
      result[key] = value === "true";
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function buildCrudRouter(Model, idField) {
  const router = express.Router();

  // List with query filters
  router.get("/", async (req, res, next) => {
    try {
      const filters = coerceQueryTypes(req.query);
      const docs = await Model.find(filters).lean();
      res.json(docs);
    } catch (err) {
      next(err);
    }
  });

  // Get by id
  router.get(`/:id`, async (req, res, next) => {
    try {
      const idVal = Number(req.params.id);
      const doc = await Model.findOne({ [idField]: idVal }).lean();
      if (!doc) return res.status(404).json({ message: "Not found" });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  // Create
  router.post("/", async (req, res, next) => {
    try {
      const created = await Model.create(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Update
  router.put(`/:id`, async (req, res, next) => {
    try {
      const idVal = Number(req.params.id);
      const updated = await Model.findOneAndUpdate(
        { [idField]: idVal },
        req.body,
        { new: true }
      );
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete
  router.delete(`/:id`, async (req, res, next) => {
    try {
      const idVal = Number(req.params.id);
      const deleted = await Model.findOneAndDelete({ [idField]: idVal });
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}


