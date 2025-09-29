import express from 'express';
import { Department } from '../models/departments.js';
import { Section } from '../models/sections.js';
import { Employee } from '../models/employees.js';
import { departmentCreate, departmentUpdate, paginationSchema } from '../validation/schemas.js';
import { authRequired, requirePerm } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and management.departments permission
router.use(authRequired);
router.use(requirePerm('management.departments'));

/**
 * GET /api/departments
 * Get paginated list of departments
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [departments, total] = await Promise.all([
      Department.find({})
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Department.countDocuments({})
    ]);

    res.json({
      ok: true,
      data: departments,
      meta: { total, page, limit }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/departments/:id
 * Get single department by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id).lean();

    if (!department) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Department not found' }
      });
    }

    res.json({
      ok: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/departments
 * Create new department
 */
router.post('/', async (req, res, next) => {
  try {
    const validatedData = departmentCreate.parse(req.body);
    
    const department = new Department(validatedData);
    await department.save();

    res.status(201).json({
      ok: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/departments/:id
 * Update department
 */
router.put('/:id', async (req, res, next) => {
  try {
    const validatedData = departmentUpdate.parse(req.body);

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    );

    if (!department) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Department not found' }
      });
    }

    res.json({
      ok: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/departments/:id
 * Delete department (only if no sections or employees exist)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const departmentId = req.params.id;

    // Check if department has sections or employees
    const [sectionCount, employeeCount] = await Promise.all([
      Section.countDocuments({ departmentId }),
      Employee.countDocuments({ departmentId })
    ]);

    if (sectionCount > 0 || employeeCount > 0) {
      return res.status(409).json({
        ok: false,
        error: {
          message: 'Cannot delete department with existing sections or employees',
          details: {
            sections: sectionCount,
            employees: employeeCount
          }
        }
      });
    }

    const department = await Department.findByIdAndDelete(departmentId);

    if (!department) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Department not found' }
      });
    }

    res.json({
      ok: true,
      data: { message: 'Department deleted successfully' }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/departments/:id/sections
 * Get sections for a specific department
 */
router.get('/:id/sections', async (req, res, next) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;
    const departmentId = req.params.id;

    // Verify department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        ok: false,
        error: { message: 'Department not found' }
      });
    }

    const [sections, total] = await Promise.all([
      Section.find({ departmentId })
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Section.countDocuments({ departmentId })
    ]);

    res.json({
      ok: true,
      data: sections,
      meta: { total, page, limit }
    });
  } catch (error) {
    next(error);
  }
});

export default router;