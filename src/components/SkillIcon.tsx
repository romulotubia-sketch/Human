import { SkillId } from '../types/game';

interface SkillIconProps {
  skillId: SkillId | 'basic_sword' | 'basic_claw' | 'basic_ghoul' | 'basic_ghost' | 'basic_pipe';
  className?: string;
}

export function SkillIcon({ skillId, className = 'w-7 h-7' }: SkillIconProps) {
  switch (skillId) {
    case 'basic_sword':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M8 28L14 22M11 21L15 25M13 23L28 8L30 6L28 11L15 24"
            stroke="#f8fafc"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M18 18L27 9" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'basic_claw':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 27C12 18 19 11 27 8" stroke="#a3e635" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M11 30C15 21 22 14 30 11" stroke="#ecfccb" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M6 23C10 15 16 9 23 6" stroke="#4ade80" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'basic_ghoul':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 26C11 16 19 10 29 7" stroke="#fb7185" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M9 30C14 20 22 14 31 11" stroke="#fff1f2" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M30 26C25 16 17 10 7 7" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M27 30C22 20 14 14 5 11" stroke="#fda4af" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'bone_slash':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M7 25C12 12 22 8 30 11C24 14 17 19 13 28"
            fill="#67e8f9"
            fillOpacity="0.35"
            stroke="#67e8f9"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M9 28L26 11" stroke="#f8fafc" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );

    case 'bone_spear':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 30L27 9" stroke="#e0f2fe" strokeWidth="2.8" strokeLinecap="round" />
          <path
            d="M21 8L30 6L28 15L24 12L21 8Z"
            fill="#38bdf8"
            stroke="#f8fafc"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'ribcage_shield':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M18 6L28 10V18C28 24.5 23.5 29 18 31C12.5 29 8 24.5 8 18V10L18 6Z"
            fill="#fde68a"
            fillOpacity="0.2"
            stroke="#fde68a"
            strokeWidth="2.3"
          />
          <path d="M18 10V26M12 14H24M13 19H23" stroke="#fef3c7" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'skeletal_rush':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 22H18M4 16H14M8 27H16" stroke="#34d399" strokeWidth="2.3" strokeLinecap="round" />
          <path
            d="M16 11L30 18L16 25L20 18L16 11Z"
            fill="#34d399"
            fillOpacity="0.35"
            stroke="#ecfdf5"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'bone_storm':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="10" stroke="#67e8f9" strokeWidth="2.2" strokeDasharray="5 4" />
          <circle cx="18" cy="18" r="5" stroke="#ecfeff" strokeWidth="2" />
        </svg>
      );

    case 'bone_colossus':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M11 12L13 6L18 10L23 6L25 12"
            stroke="#fbbf24"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="19" r="8" fill="#fef3c7" fillOpacity="0.2" stroke="#fde68a" strokeWidth="2.3" />
          <circle cx="15" cy="18" r="1.8" fill="#fbbf24" />
          <circle cx="21" cy="18" r="1.8" fill="#fbbf24" />
        </svg>
      );

    case 'army_of_bones':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="13" r="5" stroke="#4ade80" strokeWidth="2.2" />
          <circle cx="10" cy="18" r="4" stroke="#bbf7d0" strokeWidth="2" />
          <circle cx="26" cy="18" r="4" stroke="#bbf7d0" strokeWidth="2" />
          <path d="M8 28H28" stroke="#4ade80" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'reapers_judgment':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M10 29L25 8" stroke="#f5d0fe" strokeWidth="2.6" strokeLinecap="round" />
          <path
            d="M24 8C14 6 7 12 7 20C12 15 18 13 23 14"
            fill="#c084fc"
            fillOpacity="0.4"
            stroke="#c084fc"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );

    // === ZOMBIE SKILL ICONS ===
    case 'rotting_claw':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M7 26C11 16 18 10 28 8" stroke="#a3e635" strokeWidth="2.7" strokeLinecap="round" />
          <path d="M10 29C14 20 21 14 30 12" stroke="#d9f99d" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M13 31C17 24 23 19 30 17" stroke="#84cc16" strokeWidth="2.3" strokeLinecap="round" />
        </svg>
      );

    case 'plague_burst':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="15" cy="19" r="7" fill="#84cc16" fillOpacity="0.3" stroke="#a3e635" strokeWidth="2.2" />
          <circle cx="22" cy="16" r="6" fill="#a855f7" fillOpacity="0.25" stroke="#c084fc" strokeWidth="2" />
          <circle cx="19" cy="23" r="5" fill="#4ade80" fillOpacity="0.3" stroke="#86efac" strokeWidth="2" />
        </svg>
      );

    case 'flesh_ripper':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M5 18H19" stroke="#86efac" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M15 9L29 18L15 27" stroke="#4ade80" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 12L31 18L20 24" stroke="#ecfccb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'undying_flesh':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 8V28M8 18H28" stroke="#4ade80" strokeWidth="4.2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="12" stroke="#86efac" strokeWidth="1.8" strokeDasharray="4 4" />
        </svg>
      );

    case 'grave_call':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M11 28V15C11 11 14 8 18 8C22 8 25 11 25 15V28"
            fill="#a855f7"
            fillOpacity="0.25"
            stroke="#d8b4fe"
            strokeWidth="2.3"
          />
          <path d="M7 28H29" stroke="#84cc16" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M18 13V21M15 16H21" stroke="#ecfccb" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'abomination_form':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 14L12 7L16 12M28 14L24 7L20 12" stroke="#a3e635" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="18" cy="20" r="9" fill="#84cc16" fillOpacity="0.28" stroke="#bef264" strokeWidth="2.4" />
          <path d="M14 16L17 19M22 16L19 19" stroke="#ecfccb" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'kingdom_of_the_dead':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="12" r="4.5" stroke="#a3e635" strokeWidth="2.2" />
          <circle cx="10" cy="17" r="4" stroke="#86efac" strokeWidth="2" />
          <circle cx="26" cy="17" r="4" stroke="#86efac" strokeWidth="2" />
          <path d="M6 28H30M10 22V28M18 18V28M26 22V28" stroke="#c084fc" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'deaths_embrace':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="11" stroke="#a855f7" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="6" fill="#84cc16" fillOpacity="0.35" stroke="#a3e635" strokeWidth="2.2" />
          <path d="M18 4V9M18 27V32M4 18H9M27 18H32" stroke="#d8b4fe" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // === GHOUL – FERAL STALKER SKILL ICONS ===
    case 'rending_claws':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 25C12 14 20 9 30 7" stroke="#fb7185" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M9 28C15 17 23 12 31 10" stroke="#fff1f2" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M12 31C18 21 25 16 32 14" stroke="#e11d48" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'feral_pounce':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M6 26C10 13 20 9 29 14"
            stroke="#fb7185"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M23 9L31 14L24 20"
            stroke="#fff1f2"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="28" cy="24" r="4" stroke="#fda4af" strokeWidth="1.9" />
        </svg>
      );

    case 'shadow_stalker':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M22 7C14 8 9 14 10 22C11 28 17 31 25 29C19 27 16 22 17 16C18 11 20 8 22 7Z"
            fill="#e11d48"
            fillOpacity="0.35"
            stroke="#fda4af"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M14 14L28 24M27 14L15 24" stroke="#fff1f2" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'blood_frenzy':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M7 27L29 9M9 9L27 27" stroke="#ef4444" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M11 29L29 13M7 13L25 29" stroke="#ffe4e6" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="12" stroke="#fb7185" strokeWidth="1.8" strokeDasharray="4 3" />
        </svg>
      );

    case 'predators_leap':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 6V21M12 16L18 22L24 16" stroke="#fff1f2" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="18" cy="26" rx="11" ry="4.5" fill="#f43f5e" fillOpacity="0.3" stroke="#fb7185" strokeWidth="2.2" />
        </svg>
      );

    case 'apex_predator':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 15L11 6L16 12M28 15L25 6L20 12" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18" cy="20" r="8.5" fill="#e11d48" fillOpacity="0.3" stroke="#fda4af" strokeWidth="2.3" />
          <path d="M13 18L16.5 20M23 18L19.5 20" stroke="#fff1f2" strokeWidth="2.3" strokeLinecap="round" />
        </svg>
      );

    case 'carnage_unleashed':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M6 12L30 24M6 24L30 12M18 5L18 31" stroke="#fb7185" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="18" cy="18" r="5" fill="#e11d48" stroke="#fff1f2" strokeWidth="2" />
        </svg>
      );

    case 'king_of_the_hunt':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="10" stroke="#e11d48" strokeWidth="2.3" />
          <path d="M18 4V10M18 26V32M4 18H10M26 18H32" stroke="#fda4af" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M13 13L23 23M23 13L13 23" stroke="#fff1f2" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'feral_instinct':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M5 18C9 11 14 9 18 9C22 9 27 11 31 18C27 25 22 27 18 27C14 27 9 25 5 18Z"
            fill="#e11d48"
            fillOpacity="0.25"
            stroke="#fb7185"
            strokeWidth="2.2"
          />
          <path d="M18 12L20 18L18 24L16 18L18 12Z" fill="#fff1f2" />
        </svg>
      );

    case 'predators_momentum':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M7 11L16 18L7 25M17 11L26 18L17 25" stroke="#fb7185" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M25 13L31 18L25 23" stroke="#fff1f2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'basic_ghost':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M18 6C22.5 10 25 14.5 25 19C25 23.5 21.8 27 18 27C14.2 27 11 23.5 11 19C11 14.5 13.5 10 18 6Z"
            fill="#818cf8"
            fillOpacity="0.35"
            stroke="#c7d2fe"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="19" r="3.6" fill="#2dd4bf" />
          <path d="M8 29C12 32 24 32 28 29" stroke="#5eead4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'spectral_bolt':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M5 27L29 9" stroke="#818cf8" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M21 8L30 8L28 17" stroke="#e0e7ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <ellipse cx="17" cy="18" rx="9" ry="3.8" transform="rotate(-37 17 18)" stroke="#2dd4bf" strokeWidth="1.9" />
        </svg>
      );

    case 'phantom_dash':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M5 14H22M8 20H27M6 26H19" stroke="#5eead4" strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="26" cy="16" r="5.5" fill="#818cf8" fillOpacity="0.4" stroke="#e0e7ff" strokeWidth="2.2" />
        </svg>
      );

    case 'soul_drain':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M7 9C13 9 13 18 18 18M29 9C23 9 23 18 18 18M8 28C13 26 15 22 18 18M28 28C23 26 21 22 18 18" stroke="#2dd4bf" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="5" fill="#818cf8" stroke="#e0e7ff" strokeWidth="2.1" />
        </svg>
      );

    case 'wailing_scream':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="18" r="4.5" fill="#c084fc" fillOpacity="0.35" stroke="#e9d5ff" strokeWidth="2.1" />
          <path d="M20 12C23 15 23 21 20 24M25 8C30 13.5 30 22.5 25 28" stroke="#5eead4" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case 'haunted_possession':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M10 8H26M13 8V16M23 8V16" stroke="#c084fc" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="18" cy="23" r="6.5" fill="#818cf8" fillOpacity="0.35" stroke="#e0e7ff" strokeWidth="2.2" />
          <circle cx="15.8" cy="22.5" r="1.3" fill="#2dd4bf" />
          <circle cx="20.2" cy="22.5" r="1.3" fill="#2dd4bf" />
        </svg>
      );

    case 'eternal_nightmare':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M23 7C15 7.5 9 13.5 9 21C9 26.5 13.5 30 20 30C15.5 27.5 14 23 15.5 18C17 13 20 9.5 23 7Z"
            fill="#6366f1"
            fillOpacity="0.4"
            stroke="#c7d2fe"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="15" r="1.8" fill="#2dd4bf" />
          <circle cx="28" cy="20" r="1.8" fill="#c084fc" />
        </svg>
      );

    case 'spirit_legion':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="10" stroke="#818cf8" strokeWidth="1.8" strokeDasharray="4 3" />
          <circle cx="18" cy="7.5" r="3.2" fill="#2dd4bf" stroke="#e0e7ff" strokeWidth="1.6" />
          <circle cx="9" cy="23.5" r="3.2" fill="#c084fc" stroke="#e0e7ff" strokeWidth="1.6" />
          <circle cx="27" cy="23.5" r="3.2" fill="#818cf8" stroke="#e0e7ff" strokeWidth="1.6" />
        </svg>
      );

    case 'deaths_passage':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <ellipse cx="18" cy="19" rx="12" ry="7" fill="#312e81" fillOpacity="0.55" stroke="#818cf8" strokeWidth="2.2" />
          <path d="M18 7V15M9 14L15 17.5M27 14L21 17.5" stroke="#2dd4bf" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="18" cy="19" r="3.2" fill="#e0e7ff" />
        </svg>
      );

    case 'ethereal_body':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M18 7C12.5 7 9 11.5 9 18V28L13.5 25L18 28L22.5 25L27 28V18C27 11.5 23.5 7 18 7Z"
            fill="#818cf8"
            fillOpacity="0.28"
            stroke="#c7d2fe"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <circle cx="15" cy="16" r="1.4" fill="#5eead4" />
          <circle cx="21" cy="16" r="1.4" fill="#5eead4" />
        </svg>
      );

    case 'restless_spirit':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 6L21 15L30 18L21 21L18 30L15 21L6 18L15 15L18 6Z" fill="#2dd4bf" fillOpacity="0.3" stroke="#5eead4" strokeWidth="2.1" strokeLinejoin="round" />
          <circle cx="18" cy="18" r="2.8" fill="#e0e7ff" />
        </svg>
      );

    // === HUMAN – PIPE BRAWLER SKILL ICONS ===
    case 'basic_pipe':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 28L26 10" stroke="#cbd5e1" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M8 28L13.5 22.5" stroke="#fb923c" strokeWidth="4.4" strokeLinecap="round" />
          <path d="M23 7L29 13" stroke="#f8fafc" strokeWidth="3.8" strokeLinecap="round" />
          <path d="M27 6L29 4M30 10L32 9M23 5L23 3" stroke="#fdba74" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );

    case 'pipe_swing':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M6 21L18 11L31 15L23 23L6 21Z"
            fill="#fb923c"
            fillOpacity="0.3"
            stroke="#fdba74"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M7 25L26 12" stroke="#e2e8f0" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M23 9L28 15" stroke="#f8fafc" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );

    case 'headcracker':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M18 5V21" stroke="#e2e8f0" strokeWidth="3.8" strokeLinecap="round" />
          <path d="M13.5 19H22.5" stroke="#f8fafc" strokeWidth="3.4" strokeLinecap="round" />
          <path
            d="M7 27L13 24L18 29L23 24L29 27"
            stroke="#fb923c"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M18 22L20 25L18 28L16 25L18 22Z" fill="#fde047" />
        </svg>
      );

    case 'scrappers_dash':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M5 13H16M4 19H14M6 25H16" stroke="#fb923c" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M17 10L29 19L17 28" stroke="#fed7aa" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 24L25 14" stroke="#e2e8f0" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );

    case 'improvised_throw':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M8 24C11 11 25 9 29 18C31 24 23 29 14 27"
            stroke="#fb923c"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path d="M18 24L13 27L17 31" stroke="#fed7aa" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 19L24 15" stroke="#f8fafc" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M22 12.5L25.5 18" stroke="#cbd5e1" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );

    case 'street_fighter':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M7 27L26 9" stroke="#e2e8f0" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M23 7L28 12" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M21 15L24 19L29 20L25 23.5L26 28.5L21.5 26L17 28.5L18 23.5L14 20L19 19L21 15Z"
            fill="#fb923c"
            fillOpacity="0.4"
            stroke="#fed7aa"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'last_stand':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M18 6L28 10V18C28 24.5 23.5 29 18 31C12.5 29 8 24.5 8 18V10L18 6Z"
            fill="#ea580c"
            fillOpacity="0.32"
            stroke="#fb923c"
            strokeWidth="2.3"
          />
          <path d="M11 19H15L17 14L20 23L22 19H25" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'scrapstorm':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <polygon
            points="18,6 28,12 28,24 18,30 8,24 8,12"
            fill="#fb923c"
            fillOpacity="0.22"
            stroke="#fdba74"
            strokeWidth="2.2"
          />
          <path d="M11 25L25 11" stroke="#f8fafc" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="3" fill="#fde047" />
        </svg>
      );

    case 'one_man_army':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path
            d="M6 26L16 10L20 22L30 9"
            stroke="#fb923c"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9 13L27 25" stroke="#f8fafc" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="16" cy="10" r="2.2" fill="#fde047" />
          <circle cx="30" cy="9" r="2.2" fill="#fde047" />
        </svg>
      );

    case 'improvised_fighter':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <path d="M8 27L23 12" stroke="#cbd5e1" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M25 8L28 11L25 14L22 11L25 8Z" fill="#fb923c" stroke="#fef08a" strokeWidth="1.6" />
          <path d="M28 18L30 20L28 22L26 20L28 18Z" fill="#fdba74" />
        </svg>
      );

    case 'survivors_instinct':
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <polygon
            points="18,9 26,18 18,27 10,18"
            fill="#fb923c"
            fillOpacity="0.28"
            stroke="#fdba74"
            strokeWidth="2.2"
          />
          <path d="M5 18H9M27 18H31M18 5V9M18 27V31" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="2.6" fill="#f8fafc" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
          <circle cx="18" cy="18" r="8" stroke="#fde68a" strokeWidth="2.2" />
        </svg>
      );
  }
}
