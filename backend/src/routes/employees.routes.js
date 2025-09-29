import express from 'express';
import { Employee } from '../models/employees.js';
import { Department } from '../models/departments.js';
import { Section } from '../models/sections.js';
import { User } from '../models/users.js';
import { employeeCreate, employeeUpdate, employeeQuery } from '../validation/schemas.js';
import { authRequired, requirePerm } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and management.employees permission
router.use(authRequired);
router.use(requirePerm('management.employees'));

/**
 * GET /api/employees
 * Get paginated list of employees with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, departmentId, sectionId } = employeeQuery.parse(req.query);
    const skip = (page - 1) * limit;

    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (sectionId) filter.sectionId = sectionId;

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate('departmentId', 'name')
        .populate('sectionId', 'name')
        .select('employee_id name shift title phone departmentId sectionId createdAt updatedAt')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Employee.countDocuments(filter)
    ]);

    res.json({
      ok: true,
      data: employees,
      meta: { total, page, limit }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employees/unassigned
 * Get employees without a linked user account
 */
router.get('/unassigned', async (req, res, next) => {
  try {
    // Get all user employee IDs
    const userEmployeeIds = await User.find({ employeeId: { $ne: null } })
      .distinct('employeeId');

    // Find employees not in the user list
    const employees = await Employee.find({
      _id: { $nin: userEmployeeIds }
    })
      .populate('departmentId', 'name')
      .populate('sectionId', 'name')
      .select('employee_id name title departmentId sectionId')
      .sort({ name: 1 })
      .lean();

    res.json({
      ok: true,
      data: employees
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/employees/:id
 * Get single employee by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('departmentId', 'name')
      .populate('sectionId', 'name')
      .lean();

    if (!employee) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Employee not found' }
      });
    }

    res.json({
      ok: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/employees
 * Create new employee with department/section validation
 */
router.post('/', async (req, res, next) => {
  try {
    const validatedData = employeeCreate.parse(req.body);

    // Verify department exists
    const department = await Department.findById(validatedData.departmentId);
    if (!department) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Department not found' }
      });
    }

    // Verify section exists and belongs to the department
    const section = await Section.findById(validatedData.sectionId);
    if (!section) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Section not found' }
      });
    }

    if (section.departmentId.toString() !== validatedData.departmentId) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Section does not belong to the specified department' }
      });
    }

    const employee = new Employee(validatedData);
    await employee.save();

    // Populate for response
    await employee.populate(['departmentId', 'sectionId']);

    res.status(201).json({
      ok: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/employees/:id
 * Update employee with department/section validation
 */
router.put('/:id', async (req, res, next) => {
  try {
    const validatedData = employeeUpdate.parse(req.body);

    // If updating department/section, validate the relationship
    if (validatedData.departmentId || validatedData.sectionId) {
      const employee = await Employee.findById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          ok: false,
          error: { message: 'Employee not found' }
        });
      }

      const deptId = validatedData.departmentId || employee.departmentId;
      const sectId = validatedData.sectionId || employee.sectionId;

      // Verify department exists
      const department = await Department.findById(deptId);
      if (!department) {
        return res.status(400).json({
          ok: false,
          error: { message: 'Department not found' }
        });
      }

      // Verify section exists and belongs to department
      const section = await Section.findById(sectId);
      if (!section) {
        return res.status(400).json({
          ok: false,
          error: { message: 'Section not found' }
        });
      }

      if (section.departmentId.toString() !== deptId.toString()) {
        return res.status(400).json({
          ok: false,
          error: { message: 'Section does not belong to the specified department' }
        });
      }
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    ).populate(['departmentId', 'sectionId']);

    if (!employee) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Employee not found' }
      });
    }

    res.json({
      ok: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/employees/:id
 * Delete employee
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Employee not found' }
      });
    }

    res.json({
      ok: true,
      data: { message: 'Employee deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
});

export default router;