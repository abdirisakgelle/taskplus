import express from "express";
import { Task } from "../models/tasks.js";
import { User } from "../models/users.js";
import { Employee } from "../models/employees.js";
import { Notification } from "../models/notifications.js";
import { authRequired, requirePerm } from "../middleware/auth.js";

const router = express.Router();

// Get tasks with advanced filtering and pagination
router.get("/", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const {
      status,
      priority,
      assigned_to,
      created_by,
      due_date_from,
      due_date_to,
      page = 1,
      limit = 10,
      sort_by = 'createdAt',
      sort_order = 'desc',
      search
    } = req.query;

    // Build filter object
    const filters = {};
    
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (assigned_to) filters.assigned_to = Number(assigned_to);
    if (created_by) filters.created_by = Number(created_by);
    
    // Date range filtering
    if (due_date_from || due_date_to) {
      filters.due_date = {};
      if (due_date_from) filters.due_date.$gte = new Date(due_date_from);
      if (due_date_to) filters.due_date.$lte = new Date(due_date_to);
    }

    // Text search
    if (search) {
      filters.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortObj = {};
    sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

    // Execute query
    const [tasks, total] = await Promise.all([
      Task.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Task.countDocuments(filters)
    ]);

    // Get user and employee details for tasks
    const userIds = [...new Set([...tasks.map(t => t.assigned_to), ...tasks.map(t => t.created_by)].filter(Boolean))];
    const users = await User.find({ user_id: { $in: userIds } }).select('user_id username employee_id').lean();
    const employeeIds = users.map(u => u.employee_id).filter(Boolean);
    const employees = await Employee.find({ employee_id: { $in: employeeIds } }).select('employee_id name').lean();

    // Map user and employee data
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));

    const enrichedTasks = tasks.map(task => {
      const assignedUser = userMap.get(task.assigned_to);
      const createdByUser = userMap.get(task.created_by);
      
      return {
        ...task,
        assigned_to_user: assignedUser ? {
          ...assignedUser,
          employee: assignedUser.employee_id ? employeeMap.get(assignedUser.employee_id) : null
        } : null,
        created_by_user: createdByUser ? {
          ...createdByUser,
          employee: createdByUser.employee_id ? employeeMap.get(createdByUser.employee_id) : null
        } : null
      };
    });

    res.json({
      tasks: enrichedTasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get single task with details
router.get("/:id", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const task = await Task.findOne({ task_id: taskId }).lean();
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Get user and employee details
    const userIds = [task.assigned_to, task.created_by].filter(Boolean);
    const users = await User.find({ user_id: { $in: userIds } }).select('user_id username employee_id').lean();
    const employeeIds = users.map(u => u.employee_id).filter(Boolean);
    const employees = await Employee.find({ employee_id: { $in: employeeIds } }).select('employee_id name').lean();

    const userMap = new Map(users.map(u => [u.user_id, u]));
    const employeeMap = new Map(employees.map(e => [e.employee_id, e]));

    const assignedUser = userMap.get(task.assigned_to);
    const createdByUser = userMap.get(task.created_by);

    const enrichedTask = {
      ...task,
      assigned_to_user: assignedUser ? {
        ...assignedUser,
        employee: assignedUser.employee_id ? employeeMap.get(assignedUser.employee_id) : null
      } : null,
      created_by_user: createdByUser ? {
        ...createdByUser,
        employee: createdByUser.employee_id ? employeeMap.get(createdByUser.employee_id) : null
      } : null
    };

    res.json(enrichedTask);
  } catch (err) {
    next(err);
  }
});

// Create task
router.post("/", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const { title, description, assigned_to, status, priority, due_date } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    // Validate assigned user exists
    if (assigned_to) {
      const assignedUser = await User.findOne({ user_id: assigned_to });
      if (!assignedUser) {
        return res.status(400).json({ message: "Assigned user not found" });
      }
    }

    const taskData = {
      title,
      description,
      assigned_to,
      created_by: req.user.user_id,
      status: status || "Not Started",
      priority: priority || "Medium",
      due_date: due_date ? new Date(due_date) : null
    };

    const task = await Task.create(taskData);

    // Send notification to assigned user
    if (assigned_to && assigned_to !== req.user.user_id) {
      await Notification.create({
        user_id: assigned_to,
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${title}`,
        type: "task_assignment"
      });
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Update task
router.put("/:id", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const { title, description, assigned_to, status, priority, due_date } = req.body;
    
    const task = await Task.findOne({ task_id: taskId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if user can update this task (creator or assigned user)
    if (task.created_by !== req.user.user_id && task.assigned_to !== req.user.user_id) {
      return res.status(403).json({ message: "Not authorized to update this task" });
    }

    // Validate assigned user if changing
    if (assigned_to && assigned_to !== task.assigned_to) {
      const assignedUser = await User.findOne({ user_id: assigned_to });
      if (!assignedUser) {
        return res.status(400).json({ message: "Assigned user not found" });
      }
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (due_date !== undefined) updates.due_date = due_date ? new Date(due_date) : null;

    const updatedTask = await Task.findOneAndUpdate(
      { task_id: taskId },
      updates,
      { new: true }
    );

    // Send notifications for important changes
    if (assigned_to && assigned_to !== task.assigned_to && assigned_to !== req.user.user_id) {
      await Notification.create({
        user_id: assigned_to,
        title: "Task Reassigned",
        message: `You have been assigned to task: ${updatedTask.title}`,
        type: "task_assignment"
      });
    }

    if (status && status !== task.status && task.assigned_to && task.assigned_to !== req.user.user_id) {
      await Notification.create({
        user_id: task.assigned_to,
        title: "Task Status Updated",
        message: `Task "${updatedTask.title}" status changed to: ${status}`,
        type: "task_update"
      });
    }

    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// Delete task
router.delete("/:id", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const taskId = Number(req.params.id);
    const task = await Task.findOne({ task_id: taskId });
    
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Only creator can delete task
    if (task.created_by !== req.user.user_id) {
      return res.status(403).json({ message: "Only task creator can delete this task" });
    }

    await Task.findOneAndDelete({ task_id: taskId });

    // Notify assigned user if different from creator
    if (task.assigned_to && task.assigned_to !== req.user.user_id) {
      await Notification.create({
        user_id: task.assigned_to,
        title: "Task Deleted",
        message: `Task "${task.title}" has been deleted`,
        type: "task_deletion"
      });
    }

    res.json({ message: "Task deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Get my tasks (tasks assigned to or created by current user)
router.get("/my/tasks", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const { status, priority, type = 'all' } = req.query;
    
    let filters = {};
    
    // Filter by type
    if (type === 'assigned') {
      filters.assigned_to = req.user.user_id;
    } else if (type === 'created') {
      filters.created_by = req.user.user_id;
    } else {
      filters.$or = [
        { assigned_to: req.user.user_id },
        { created_by: req.user.user_id }
      ];
    }

    if (status) filters.status = status;
    if (priority) filters.priority = priority;

    const tasks = await Task.find(filters)
      .sort({ updatedAt: -1 })
      .lean();

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// Get task statistics
router.get("/stats/overview", authRequired, requirePerm('operations.view'), async (req, res, next) => {
  try {
    const { user_id, date_from, date_to } = req.query;
    
    let matchFilter = {};
    if (user_id) {
      matchFilter.$or = [
        { assigned_to: Number(user_id) },
        { created_by: Number(user_id) }
      ];
    }

    if (date_from || date_to) {
      matchFilter.createdAt = {};
      if (date_from) matchFilter.createdAt.$gte = new Date(date_from);
      if (date_to) matchFilter.createdAt.$lte = new Date(date_to);
    }

    const stats = await Task.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
          },
          in_progress: {
            $sum: { $cond: [{ $eq: ["$status", "In Progress"] }, 1, 0] }
          },
          not_started: {
            $sum: { $cond: [{ $eq: ["$status", "Not Started"] }, 1, 0] }
          },
          high_priority: {
            $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] }
          },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$due_date", null] },
                    { $lt: ["$due_date", new Date()] },
                    { $ne: ["$status", "Completed"] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      completed: 0,
      in_progress: 0,
      not_started: 0,
      high_priority: 0,
      overdue: 0
    };

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
