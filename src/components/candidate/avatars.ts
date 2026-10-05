import { art } from "@/components/mc/art";

/**
 * Characters a candidate can choose for their ID card. Standing figures from
 * the art set that crop well into a small portrait. The choice is kept on the
 * sign-in account (user metadata, key "avatar"), so no record changes.
 */
export const AVATARS: { key: string; label: string; src: string }[] = [
  { key: "charNurse", label: "Nurse with backpack", src: art.charNurse },
  { key: "nurseWomanCoat", label: "Nurse, natural hair", src: art.nurseWomanCoat },
  { key: "nurseMan2", label: "Male nurse", src: art.nurseMan2 },
  { key: "charDoctor", label: "Doctor with tablet", src: art.charDoctor },
  { key: "doctorWoman", label: "Doctor, locs", src: art.doctorWoman },
  { key: "pharmacistMedicineCarton", label: "Pharmacist", src: art.pharmacistMedicineCarton },
  { key: "scientistSampleRack", label: "Lab scientist", src: art.scientistSampleRack },
  { key: "charCaregiver", label: "Caregiver", src: art.charCaregiver },
  { key: "carerManJacket", label: "Male carer", src: art.carerManJacket },
  { key: "nursingStudentTextbooks", label: "Student", src: art.nursingStudentTextbooks },
];

export const avatarFor = (key?: string | null) => AVATARS.find((a) => a.key === key)?.src;
