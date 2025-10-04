import { Link } from 'react-router-dom';
import NasiyeLogo from '@/assets/images/Nasiye logo.png';
const LogoBox = ({
  containerClassName,
  squareLogo,
  textLogo
}) => {
  const defaultLogo = NasiyeLogo;
  return <div className={containerClassName ?? ''}>
      <Link to="/" className="logo-dark">
        <img src={defaultLogo} className={(textLogo?.className ?? squareLogo?.className)} height={(textLogo?.height ?? squareLogo?.height ?? 24)} width={(textLogo?.width ?? squareLogo?.width)} alt="logo" />
      </Link>
      <Link to="/" className="logo-light">
        <img src={defaultLogo} className={(textLogo?.className ?? squareLogo?.className)} height={(textLogo?.height ?? squareLogo?.height ?? 24)} width={(textLogo?.width ?? squareLogo?.width)} alt="logo" />
      </Link>
    </div>;
};
export default LogoBox;