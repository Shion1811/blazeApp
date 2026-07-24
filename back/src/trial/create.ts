// POST /api/trial-application — 体験申し込み（認証不要・レートリミットあり）

import { z } from "../index.js";
import {
  db,
  trialApplication,
  emailSchema,
  trialDateSchema,
  trialNameSchema,
  furiganaSchema,
  genderSchema,
  birthDateSchema,
  schoolNameSchema,
  cramSchoolSchema,
  phoneNumberSchema,
  motivationSchema,
  motivationOtherSchema,
  referrerNameSchema,
  sendTrialApplicationConfirmationEmail,
  sendTrialApplicationAdminNotification,
} from "../shared/index.js";
import type { Context } from "hono";

const schema = z
  .object({
    email: emailSchema,
    trial_date: trialDateSchema,
    name: trialNameSchema,
    furigana: furiganaSchema,
    gender: genderSchema,
    birth_date: birthDateSchema,
    school_name: schoolNameSchema,
    cram_school: cramSchoolSchema,
    phone_number: phoneNumberSchema,
    motivation: motivationSchema,
    motivation_other: motivationOtherSchema,
    referrer_name: referrerNameSchema,
  })
  .superRefine((data, ctx) => {
    if (data.motivation === "other" && !data.motivation_other) {
      ctx.addIssue({
        code: "custom",
        path: ["motivation_other"],
        message: "きっかけで「その他」を選んだ場合は内容を入力してください。",
      });
    }
  });

export const create = async (c: Context) => {
  const body = await c.req.parseBody();

  const result = schema.safeParse({
    email: body["email"],
    trial_date: body["trial_date"],
    name: body["name"],
    furigana: body["furigana"],
    gender: body["gender"],
    birth_date: body["birth_date"],
    school_name: body["school_name"],
    cram_school: body["cram_school"],
    phone_number: body["phone_number"],
    motivation: body["motivation"],
    motivation_other: body["motivation_other"],
    referrer_name: body["referrer_name"],
  });

  if (!result.success) {
    return c.json(
      {
        success: false,
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      400,
    );
  }

  const data = result.data;

  const inserted = await db
    .insert(trialApplication)
    .values({
      email: data.email,
      trial_date: data.trial_date,
      name: data.name,
      furigana: data.furigana,
      gender: data.gender,
      birth_date: data.birth_date,
      school_name: data.school_name,
      cram_school: data.cram_school ?? null,
      phone_number: data.phone_number,
      motivation: data.motivation,
      motivation_other: data.motivation_other ?? null,
      referrer_name: data.referrer_name ?? null,
    })
    .returning();

  const mailData = {
    email: data.email,
    name: data.name,
    furigana: data.furigana,
    trialDate: data.trial_date,
    gender: data.gender,
    birthDate: data.birth_date,
    schoolName: data.school_name,
    cramSchool: data.cram_school,
    phoneNumber: data.phone_number,
    motivation: data.motivation,
    motivationOther: data.motivation_other,
    referrerName: data.referrer_name,
  };

  try {
    await sendTrialApplicationConfirmationEmail(mailData);
  } catch (e) {
    console.error("[trial-application] 確認メール送信失敗:", e);
  }

  try {
    await sendTrialApplicationAdminNotification(mailData);
  } catch (e) {
    console.error("[trial-application] 通知メール送信失敗:", e);
  }

  return c.json(
    { success: true, message: "体験申し込みを受け付けました。", data: inserted[0] },
    200,
  );
};
