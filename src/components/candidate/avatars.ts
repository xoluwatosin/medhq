import { art } from "@/components/mc/art";

/**
 * Characters a candidate can choose for their ID card. Standing figures from
 * the art set that crop well into a small portrait. The choice is kept on the
 * sign-in account (user metadata, key "avatar"), so no record changes.
 */
export const AVATARS: { key: string; label: string; src: string }[] = [
  { key: "charNurse", label: "Kira John", src: art.charNurse },
  { key: "nurseWomanCoat", label: "Ngozi Okafor", src: art.nurseWomanCoat },
  { key: "nurseMan2", label: "Tunde Williams", src: art.nurseMan2 },
  { key: "charDoctor", label: "Emeka Davies", src: art.charDoctor },
  { key: "doctorWoman", label: "Amaka Brown", src: art.doctorWoman },
  { key: "pharmacistMedicineCarton", label: "Grace Adeyemi", src: art.pharmacistMedicineCarton },
  { key: "scientistSampleRack", label: "Chidi Thompson", src: art.scientistSampleRack },
  { key: "charCaregiver", label: "Bisi Clarke", src: art.charCaregiver },
  { key: "carerManJacket", label: "Femi Harrison", src: art.carerManJacket },
  { key: "nursingStudentTextbooks", label: "Zara Okonkwo", src: art.nursingStudentTextbooks },
];

export const avatarFor = (key?: string | null) => AVATARS.find((a) => a.key === key)?.src;
