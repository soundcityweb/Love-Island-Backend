import { IslanderStatus } from '../../entities/islander-status.enum';

export class IslanderListItemDto {
  id: string;
  slug: string;
  firstName: string;
  lastName: string | null;
  age: number;
  location: string;
  tagline: string | null;
  profileImage: string | null;
  profileStatusLabel: string | null;
  status: IslanderStatus;
}

export class IslanderMediaItemDto {
  type: string;
  storageKey: string;
  displayOrder: number;
  altText: string | null;
}

export class IslanderDetailDto extends IslanderListItemDto {
  occupation: string | null;
  bio: string | null;
  lookingFor: string | null;
  coverImage: string | null;
  funFacts: Array<{ icon: string; label: string; value: string }> | null;
  socialLinks: Array<{ platform: string; handle: string; url: string }> | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  twitterImage: string | null;
  keywords: string | null;
  media: IslanderMediaItemDto[];
  createdAt: Date;
  updatedAt: Date;
}
