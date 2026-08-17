import { z } from 'zod';
import { FUEL_TYPES, VEHICLE_TYPES } from '@/lib/constants';

// ============================================================
// VEHICLE SCHEMA
// ============================================================
export const vehicleSchema = z.object({
  plate: z
    .string()
    .min(7, 'Placa deve ter pelo menos 7 caracteres')
    .max(8, 'Placa deve ter no máximo 8 caracteres')
    .regex(/^[A-Za-z0-9]+$/, 'Placa deve conter apenas letras e números'),
  prefix: z.string().min(1, 'Prefixo é obrigatório'),
  model: z.string().min(1, 'Modelo é obrigatório'),
  brand: z.string().min(1, 'Marca é obrigatória'),
  branchId: z.string().min(1, 'Filial é obrigatória'),
  branchName: z.string().min(1, 'Filial é obrigatória'),
  status: z.enum(['active', 'inactive', 'maintenance']),
  type: z.enum(VEHICLE_TYPES as [string, ...string[]]),
  fuelType: z.enum(FUEL_TYPES as [string, ...string[]]),
  currentOdometer: z.number().min(0, 'Hodômetro deve ser positivo'),
  year: z.number().min(1980).max(new Date().getFullYear() + 1).optional(),
  color: z.string().optional(),
  observations: z.string().optional(),
});

// ============================================================
// STATION SCHEMA
// ============================================================
export const stationSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  city: z.string().min(2, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 letras'),
  type: z.string().min(1, 'Tipo é obrigatório'),
  active: z.boolean(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  observations: z.string().optional(),
});

// ============================================================
// REFUEL SCHEMA
// ============================================================
export const refuelSchema = z
  .object({
    date: z.date({ message: 'Data é obrigatória' }),
    vehicleId: z.string().min(1, 'Selecione o veículo'),
    vehiclePlate: z.string().min(1, 'Placa é obrigatória'),
    vehiclePrefix: z.string(),
    vehicleModel: z.string(),
    vehicleBranch: z.string(),
    vehicleBranchId: z.string(),
    stationId: z.string().min(1, 'Selecione o posto'),
    stationName: z.string().min(1, 'Posto é obrigatório'),
    city: z.string().min(1, 'Cidade é obrigatória'),
    state: z.string(),
    fuelType: z.enum(FUEL_TYPES as [string, ...string[]]),
    liters: z.number().min(0.1, 'Litros deve ser maior que 0'),
    unitPrice: z.number().min(0.01, 'Valor unitário deve ser maior que 0'),
    previousOdometer: z.number().min(0, 'Hodômetro anterior deve ser positivo'),
    currentOdometer: z.number().min(0, 'Hodômetro atual deve ser positivo'),
    paymentMethod: z.string().optional(),
    invoiceNumber: z.string().optional(),
    observations: z.string().optional(),
  })
  .refine(
    (data) => data.currentOdometer >= data.previousOdometer,
    {
      message: 'Hodômetro atual não pode ser menor que o anterior',
      path: ['currentOdometer'],
    }
  );

// ============================================================
// MONTHLY EXPENSE SCHEMA
// ============================================================
export const monthlyExpenseSchema = z.object({
  competence: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Competência deve ser no formato YYYY-MM'),
  supplierName: z.string().min(1, 'Fornecedor é obrigatório'),
  category: z.enum(['NF', 'CARD', 'VIBRA', 'OTHER']),
  categoryLabel: z.string(),
  value: z.number().min(0.01, 'Valor deve ser maior que 0'),
  dueDate: z.date({ message: 'Vencimento é obrigatório' }),
  paymentDate: z.date().optional().nullable(),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'PARTIAL']),
  invoiceNumber: z.string().optional(),
  observations: z.string().optional(),
});

// ============================================================
// VIBRA ORDER SCHEMA
// ============================================================
export const vibraOrderSchema = z.object({
  competence: z.string().regex(/^\d{4}-\d{2}$/, 'Competência deve ser YYYY-MM'),
  issueDate: z.date({ message: 'Data de emissão é obrigatória' }),
  paymentDate: z.date().optional().nullable(),
  liters: z.number().min(0.1, 'Litros deve ser maior que 0'),
  unitPrice: z.number().min(0.01, 'Valor unitário deve ser maior que 0'),
  orderNumber: z.string().optional(),
  invoiceNumber: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'PARTIAL']),
  observations: z.string().optional(),
});

// ============================================================
// USER SCHEMA
// ============================================================
export const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'operational', 'viewer']),
  phone: z.string().optional(),
});

export const createUserSchema = userSchema.extend({
  password: z
    .string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

// ============================================================
// BRANCH SCHEMA
// ============================================================
export const branchSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  city: z.string().min(2, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 letras'),
  responsible: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean(),
  observations: z.string().optional(),
});

// ============================================================
// LOGIN SCHEMA
// ============================================================
export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// ============================================================
// SETTINGS SCHEMA
// ============================================================
export const settingsSchema = z.object({
  alertThresholds: z.object({
    minAvgKmL: z.number().min(0),
    maxAvgKmL: z.number().min(0),
    maxUnitPrice: z.number().min(0),
    maxLitersPerRefuel: z.number().min(0),
    minIntervalHours: z.number().min(0),
  }),
});

// Types inferred from schemas
export type VehicleFormData = z.infer<typeof vehicleSchema>;
export type StationFormData = z.infer<typeof stationSchema>;
export type RefuelFormData = z.infer<typeof refuelSchema>;
export type MonthlyExpenseFormData = z.infer<typeof monthlyExpenseSchema>;
export type VibraOrderFormData = z.infer<typeof vibraOrderSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type BranchFormData = z.infer<typeof branchSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type SettingsFormData = z.infer<typeof settingsSchema>;
