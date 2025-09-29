import { Helmet } from 'react-helmet-async';
import { DEFAULT_PAGE_TITLE } from '@/context/constants';
const PageMetaData = ({
  title
}) => {
  const defaultTitle = DEFAULT_PAGE_TITLE;
  return <Helmet>
      <title>{title ? `${title} | Rasket React- Responsive Admin Dashboard Template` : defaultTitle}</title>
    </Helmet>;
};
export default PageMetaData;