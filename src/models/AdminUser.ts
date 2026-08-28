import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export interface AdminUserAttrs {
  email: string;
  password: string;
  name: string;
}

export interface AdminUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type AdminUserDocument = HydratedDocument<AdminUserAttrs, AdminUserMethods>;

type AdminUserModel = Model<AdminUserAttrs, {}, AdminUserMethods>;

const adminUserSchema = new Schema<AdminUserAttrs, AdminUserModel, AdminUserMethods>(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

adminUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

adminUserSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const AdminUser = model<AdminUserAttrs, AdminUserModel>("AdminUser", adminUserSchema);
