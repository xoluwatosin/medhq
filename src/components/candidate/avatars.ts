import { art } from "@/components/mc/art";

/**
 * Characters a candidate can choose for their ID card. Standing figures from
 * the art set that crop well into a small portrait. The choice is kept on the
 * sign-in account (user metadata, key "avatar"), so no record changes.
 */
export const AVATARS: { key: string; label: string; src: string }[] = [
  { key: "charNurse", label: "Kira", src: art.charNurse },
  { key: "nurseWomanCoat", label: "Ngozi", src: art.nurseWomanCoat },
  { key: "laundryAttendantLinens", label: "Tolu", src: art.laundryAttendantLinens },
  { key: "nurseMan2", label: "Tunde", src: art.nurseMan2 },
  { key: "charDoctor", label: "Emeka", src: art.charDoctor },
  { key: "doctorWoman", label: "Amaka", src: art.doctorWoman },
  { key: "scientistSampleRack", label: "Chidi", src: art.scientistSampleRack },
  { key: "locumDoctorBag", label: "Segun", src: art.locumDoctorBag },
  { key: "carerManJacket", label: "Femi", src: art.carerManJacket },
  { key: "nursingStudentTextbooks", label: "Zara", src: art.nursingStudentTextbooks },
];

export const avatarFor = (key?: string | null) => AVATARS.find((a) => a.key === key)?.src;
