import express from "express";
import { Content } from "../models/content.js";
import { Idea } from "../models/ideas.js";
import { Production } from "../models/production.js";
import { Employee } from "../models/employees.js";
import { User } from "../models/users.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get content with filtering and pagination
router.get("/", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const {
      idea_id,
      script_writer_employee_id,
      director_employee_id,
      date_from,
      date_to,
      filming_date_from,
      filming_date_to,
      search,
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc'
    } = req.query;

    // Build filters
    const filters = {};
    if (idea_id) filters.idea_id = Number(idea_id);
    if (script_writer_employee_id) filters.script_writer_employee_id = Number(script_writer_employee_id);
    if (director_employee_id) filters.director_employee_id = Number(director_employee_id);
    
    // Content date range filtering
    if (date_from || date_to) {
      filters.content_date = {};
      if (date_from) filters.content_date.$gte = new Date(date_from);
      if (date_to) filters.content_date.$lte = new Date(date_to);
    }

    // Filming date range filtering
    if (filming_date_from || filming_date_to) {
      filters.filming_date = {};
      if (filming_date_from) filters.filming_date.$gte = new Date(filming_date_from);
      if (filming_date_to) filters.filming_date.$lte = new Date(filming_date_to);
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Execute query
    const [contentItems, total] = await Promise.all([
      Content.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Content.countDocuments(filters)
    ]);

    // Get related data
    const ideaIds = [...new Set(contentItems.map(c => c.idea_id).filter(Boolean))];
    const employeeIds = [...new Set([
      ...contentItems.map(c => c.script_writer_employee_id),
      ...contentItems.map(c => c.director_employee_id),
      ...contentItems.flatMap(c => c.cast_and_presenters || [])
    ].filter(Boolean))];

    const [ideas, employees] = await Promise.all([
      Idea.find({ idea_id: { $in: ideaIds } }).select('idea_id title status').lean(),
      Employee.find({ employee_id: { $in: employeeIds } }).select('employee_id name').lean()
    ]);

    // Get production status for each content
    const contentIds = contentItems.map(c => c.content_id);
    const productions = await Production.find({ content_id: { $in: contentIds } })
      .select('content_id production_status completion_date').lean();

    const ideaMap = new Map(ideas.map(i => [i.idea_id, i]));
    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));
    const productionMap = new Map(productions.map(p => [p.content_id, p]));

    // Apply search filter after getting idea titles
    let filteredContent = contentItems;
    if (search) {
      filteredContent = contentItems.filter(content => {
        const idea = ideaMap.get(content.idea_id);
        return (
          (idea && idea.title && idea.title.toLowerCase().includes(search.toLowerCase())) ||
          (content.notes && content.notes.toLowerCase().includes(search.toLowerCase()))
        );
      });
    }

    // Enrich content
    const enrichedContent = filteredContent.map(content => ({
      ...content,
      idea_info: ideaMap.get(content.idea_id) || null,
      script_writer_info: employeeMap.get(content.script_writer_employee_id) || null,
      director_info: employeeMap.get(content.director_employee_id) || null,
      cast_info: (content.cast_and_presenters || []).map(id => employeeMap.get(id)).filter(Boolean),
      production_info: productionMap.get(content.content_id) || null
    }));

    res.json({
      content: enrichedContent,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: search ? filteredContent.length : total,
        pages: Math.ceil((search ? filteredContent.length : total) / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get single content with full details
router.get("/:id", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const contentId = Number(req.params.id);
    const content = await Content.findOne({ content_id: contentId }).lean();
    
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Get related data
    const employeeIds = [
      content.script_writer_employee_id,
      content.director_employee_id,
      ...(content.cast_and_presenters || [])
    ].filter(Boolean);

    const [idea, employees, productions] = await Promise.all([
      content.idea_id ? Idea.findOne({ idea_id: content.idea_id }).lean() : null,
      Employee.find({ employee_id: { $in: employeeIds } }).select('employee_id name').lean(),
      Production.find({ content_id: contentId }).lean()
    ]);

    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));

    const enrichedContent = {
      ...content,
      idea_info: idea,
      script_writer_info: employeeMap.get(content.script_writer_employee_id) || null,
      director_info: employeeMap.get(content.director_employee_id) || null,
      cast_info: (content.cast_and_presenters || []).map(id => employeeMap.get(id)).filter(Boolean),
      productions: productions
    };

    res.json(enrichedContent);
  } catch (err) {
    next(err);
  }
});

// Create content
router.post("/", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const {
      content_date,
      idea_id,
      script_writer_employee_id,
      director_employee_id,
      filming_date,
      cast_and_presenters,
      notes
    } = req.body;

    // Validate idea if provided
    if (idea_id) {
      const idea = await Idea.findOne({ idea_id });
      if (!idea) {
        return res.status(400).json({ message: "Invalid idea" });
      }
      if (idea.status !== 'Approved') {
        return res.status(400).json({ message: "Can only create content from approved ideas" });
      }
    }

    // Validate employees
    const employeeIds = [script_writer_employee_id, director_employee_id, ...(cast_and_presenters || [])]
      .filter(Boolean);
    
    if (employeeIds.length > 0) {
      const employees = await Employee.find({ employee_id: { $in: employeeIds } });
      if (employees.length !== employeeIds.length) {
        return res.status(400).json({ message: "One or more invalid employee IDs" });
      }
    }

    const content = await Content.create({
      content_date: content_date ? new Date(content_date) : new Date(),
      idea_id: idea_id || null,
      script_writer_employee_id: script_writer_employee_id || null,
      director_employee_id: director_employee_id || null,
      filming_date: filming_date ? new Date(filming_date) : null,
      cast_and_presenters: cast_and_presenters || [],
      notes
    });

    // Notify assigned team members
    const notifyEmployees = [script_writer_employee_id, director_employee_id, ...(cast_and_presenters || [])]
      .filter(Boolean);
    
    for (const employeeId of notifyEmployees) {
      const user = await User.findOne({ employee_id: employeeId });
      if (user) {
        await Notification.create({
          user_id: user.user_id,
          title: "New Content Assignment",
          message: `You have been assigned to new content production #${content.content_id}`,
          type: "content_assignment"
        });
      }
    }

    res.status(201).json(content);
  } catch (err) {
    next(err);
  }
});

// Update content
router.put("/:id", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const contentId = Number(req.params.id);
    const {
      content_date,
      idea_id,
      script_writer_employee_id,
      director_employee_id,
      filming_date,
      cast_and_presenters,
      notes
    } = req.body;

    const content = await Content.findOne({ content_id: contentId });
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Validate idea if changing
    if (idea_id !== undefined && idea_id !== content.idea_id) {
      if (idea_id) {
        const idea = await Idea.findOne({ idea_id });
        if (!idea) {
          return res.status(400).json({ message: "Invalid idea" });
        }
        if (idea.status !== 'Approved') {
          return res.status(400).json({ message: "Can only assign approved ideas to content" });
        }
      }
    }

    // Validate employees if changing
    const newEmployeeIds = [script_writer_employee_id, director_employee_id, ...(cast_and_presenters || [])]
      .filter(id => id !== undefined && id !== null);
    
    if (newEmployeeIds.length > 0) {
      const employees = await Employee.find({ employee_id: { $in: newEmployeeIds } });
      if (employees.length !== newEmployeeIds.length) {
        return res.status(400).json({ message: "One or more invalid employee IDs" });
      }
    }

    const updates = {};
    if (content_date !== undefined) updates.content_date = new Date(content_date);
    if (idea_id !== undefined) updates.idea_id = idea_id;
    if (script_writer_employee_id !== undefined) updates.script_writer_employee_id = script_writer_employee_id;
    if (director_employee_id !== undefined) updates.director_employee_id = director_employee_id;
    if (filming_date !== undefined) updates.filming_date = filming_date ? new Date(filming_date) : null;
    if (cast_and_presenters !== undefined) updates.cast_and_presenters = cast_and_presenters;
    if (notes !== undefined) updates.notes = notes;

    const updatedContent = await Content.findOneAndUpdate(
      { content_id: contentId },
      updates,
      { new: true }
    );

    // Notify newly assigned team members
    const oldEmployees = [
      content.script_writer_employee_id,
      content.director_employee_id,
      ...(content.cast_and_presenters || [])
    ].filter(Boolean);

    const currentEmployees = [
      updatedContent.script_writer_employee_id,
      updatedContent.director_employee_id,
      ...(updatedContent.cast_and_presenters || [])
    ].filter(Boolean);

    const newlyAssigned = currentEmployees.filter(id => !oldEmployees.includes(id));

    for (const employeeId of newlyAssigned) {
      const user = await User.findOne({ employee_id: employeeId });
      if (user) {
        await Notification.create({
          user_id: user.user_id,
          title: "Content Assignment Updated",
          message: `You have been assigned to content production #${contentId}`,
          type: "content_assignment"
        });
      }
    }

    res.json(updatedContent);
  } catch (err) {
    next(err);
  }
});

// Delete content
router.delete("/:id", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const contentId = Number(req.params.id);
    
    // Check if content has associated productions
    const productionCount = await Production.countDocuments({ content_id: contentId });
    if (productionCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete content with associated productions. Delete productions first." 
      });
    }

    const deleted = await Content.findOneAndDelete({ content_id: contentId });
    if (!deleted) {
      return res.status(404).json({ message: "Content not found" });
    }

    res.json({ message: "Content deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get content by idea
router.get("/idea/:ideaId", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const ideaId = Number(req.params.ideaId);
    
    const content = await Content.find({ idea_id: ideaId })
      .sort({ createdAt: -1 })
      .lean();

    // Get employee details
    const employeeIds = [...new Set([
      ...content.map(c => c.script_writer_employee_id),
      ...content.map(c => c.director_employee_id),
      ...content.flatMap(c => c.cast_and_presenters || [])
    ].filter(Boolean))];

    const employees = await Employee.find({ employee_id: { $in: employeeIds } })
      .select('employee_id name').lean();
    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));

    const enrichedContent = content.map(c => ({
      ...c,
      script_writer_info: employeeMap.get(c.script_writer_employee_id) || null,
      director_info: employeeMap.get(c.director_employee_id) || null,
      cast_info: (c.cast_and_presenters || []).map(id => employeeMap.get(id)).filter(Boolean)
    }));

    res.json(enrichedContent);
  } catch (err) {
    next(err);
  }
});

// Get my content (content assigned to current user)
router.get("/my/content", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    // Get current user's employee_id
    const user = await User.findOne({ user_id: req.user.user_id });
    if (!user || !user.employee_id) {
      return res.json([]);
    }

    const content = await Content.find({
      $or: [
        { script_writer_employee_id: user.employee_id },
        { director_employee_id: user.employee_id },
        { cast_and_presenters: user.employee_id }
      ]
    }).sort({ updatedAt: -1 }).lean();

    // Get idea details
    const ideaIds = [...new Set(content.map(c => c.idea_id).filter(Boolean))];
    const ideas = await Idea.find({ idea_id: { $in: ideaIds } })
      .select('idea_id title').lean();
    const ideaMap = new Map(ideas.map(i => [i.idea_id, i]));

    const enrichedContent = content.map(c => ({
      ...c,
      idea_info: ideaMap.get(c.idea_id) || null
    }));

    res.json(enrichedContent);
  } catch (err) {
    next(err);
  }
});

// Get content statistics
router.get("/stats/overview", authRequired, requirePerm('content.scripts'), async (req, res, next) => {
  try {
    const { employee_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    
    if (employee_id) {
      const empId = Number(employee_id);
      matchFilter.$or = [
        { script_writer_employee_id: empId },
        { director_employee_id: empId },
        { cast_and_presenters: empId }
      ];
    }
    
    if (date_from || date_to) {
      matchFilter.content_date = {};
      if (date_from) matchFilter.content_date.$gte = new Date(date_from);
      if (date_to) matchFilter.content_date.$lte = new Date(date_to);
    }

    const stats = await Content.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: "production",
          localField: "content_id",
          foreignField: "content_id",
          as: "productions"
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          with_productions: {
            $sum: { $cond: [{ $gt: [{ $size: "$productions" }, 0] }, 1, 0] }
          },
          filmed: {
            $sum: { $cond: [{ $ne: ["$filming_date", null] }, 1, 0] }
          },
          pending_filming: {
            $sum: { $cond: [{ $eq: ["$filming_date", null] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      with_productions: 0,
      filmed: 0,
      pending_filming: 0
    };

    // Add calculated metrics
    result.production_rate = result.total > 0 ? 
      ((result.with_productions / result.total) * 100).toFixed(2) : "0.00";
    result.filming_rate = result.total > 0 ? 
      ((result.filmed / result.total) * 100).toFixed(2) : "0.00";

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
