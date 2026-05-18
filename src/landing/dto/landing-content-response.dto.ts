export class LandingContentDto {
  hero: {
    season: string;
    title: string;
    titleHighlight: string;
    description: string;
    ctaPrimary: {
      label: string;
      href: string;
    };
    ctaSecondary: {
      label: string;
      href: string;
    };
    stats: {
      applicants: string;
      days: string;
      winningCouple: string;
    };
    backgroundImage: string;
  };
  countdown: {
    label: string;
    title: string;
    timeUnits: Array<{
      label: string;
      value: string;
    }>;
    footerText: string;
  };
  videos: {
    label: string;
    title: string;
    description: string;
    featuredVideo: {
      embedUrl: string;
      title: string;
      description?: string | null;
    };
    clips: Array<{
      title: string;
      description: string;
      duration: string;
      image: string;
      tag: string;
    }>;
    ctaLabel: string;
    ctaHref: string;
  };
  sponsors: {
    label: string;
    title: string;
    description: string;
    titleSponsors: Array<{
      name: string;
      tier: string;
    }>;
    officialPartners: Array<{
      name: string;
      tier: string;
    }>;
    cta: {
      label: string;
      title: string;
      description: string;
      buttonLabel: string;
      href: string;
    };
  };
}
