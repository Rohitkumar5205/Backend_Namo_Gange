import mongoose from "mongoose";

const CategoryImageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      index: true,
    },

    image: { type: String, required: true },
    image_alt: { type: String },
    category: { type: String, required: true },

    order_by: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }, // createdAt & updatedAt auto
);

export default mongoose.model("CategoryImage", CategoryImageSchema);
