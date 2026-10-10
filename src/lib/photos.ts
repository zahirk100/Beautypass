// Editorial stock photos generated for BeautyPass (Higgsfield). Each has a full-size and a light webp version.
const BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_3K0vP0LWwSjJ1THUL9zRSUshpTj/";
const photo = (file: string) => ({ full: `${BASE}${file}.png`, small: `${BASE}${file}_min.webp` });

export const PHOTOS = {
  nailSalon: photo("hf_20261010_155255_8c6159b6-af57-47ae-a236-7cab659e17ff"),
  brows: photo("hf_20261010_155326_dd188326-b1dc-4ed1-90f4-17e9d4c6c018"),
  blowout: photo("hf_20261010_155255_ca9c1c7f-ae99-4b32-87b5-f2a87266229b"),
  polishFlatlay: photo("hf_20261010_155452_0c1d01a0-cd4b-4dd0-b2d3-525cc4ce7535"),
  reception: photo("hf_20261010_155255_b1d6e6d8-8ff7-4563-a19b-e965e968f0d8"),
  lashes: photo("hf_20261010_155255_ddcc5830-6c18-43e8-9e66-a16226540cbb"),
  premiumSalon: photo("hf_20261010_155255_57e49157-64e7-4dc5-8343-84b57fa2fec7"),
  pedicure: photo("hf_20261010_155345_e86433df-a3c8-4604-bd19-cf8a1c7307a4"),
  waterSalon: photo("hf_20261010_155255_fd6cebf4-8cbc-4832-be43-2759b5e26cbc"),
  canalWoman: photo("hf_20261010_155255_bd41a471-05c8-4604-9ced-f258ec6f3f3d"),
  plumGel: photo("hf_20261010_155402_5dfac4f7-cae9-4057-90fb-48004e5eb764"),
};

/** Mood photo per treatment slug, used when a salon has no own photo yet. */
export const TREATMENT_PHOTO: Record<string, string> = {
  gellak: PHOTOS.plumGel.small,
  biab: PHOTOS.plumGel.small,
  pedicure: PHOTOS.pedicure.small,
  blowout: PHOTOS.blowout.small,
  "brow-lamination": PHOTOS.brows.small,
  "lash-lift": PHOTOS.lashes.small,
};
