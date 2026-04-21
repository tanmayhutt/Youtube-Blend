import { useState } from "react";

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const Logo = ({ className = "", size = 32 }: LogoProps) => {
  const [imgError, setImgError] = useState(false);

  // Use logo.svg
  const logoPath = "/logo.svg";

  const handleError = () => {
    setImgError(true);
  };

  // Convert size to CSS value
  const sizeStyle = typeof size === 'number' ? `${size}px` : size;

  if (imgError) {
    // Fallback to YouTube icon if logo not found
    return (
      <svg
        className={className}
        width={sizeStyle}
        height={sizeStyle}
        viewBox="0 0 24 24"
        fill="currentColor"
        preserveAspectRatio="xMidYMid meet"
      >
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    );
  }

  return (
    <img
      src={logoPath}
      alt="YouTube Blend Logo"
      className={className}
      onError={handleError}
      style={{ 
        width: sizeStyle,
        height: "auto",
        objectFit: "contain",
        maxWidth: "100%",
        display: "block"
      }}
      loading="eager"
    />
  );
};

