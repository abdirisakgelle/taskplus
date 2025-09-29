import clsx from 'clsx';
import { Fragment, useCallback, useEffect, useState, useMemo } from 'react';
import { Collapse } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import IconifyIcon from '@/components/wrappers/IconifyIcon';
import { findAllParent, findMenuItem, getMenuItemFromURL } from '@/helpers/menu';
import { useAuth } from '@/lib/simpleAuth';
import { filterMenuByPermissions } from '@/lib/menu-permissions';
const MenuItemWithChildren = ({
  item,
  className,
  linkClassName,
  subMenuClassName,
  activeMenuItems,
  toggleMenu,
  openGroups
}) => {
  const [open, setOpen] = useState(activeMenuItems.includes(item.key) || openGroups.includes(item.key));
  useEffect(() => {
    setOpen(activeMenuItems.includes(item.key) || openGroups.includes(item.key));
  }, [activeMenuItems, item, openGroups]);
  const toggleMenuItem = e => {
    e.preventDefault();
    const status = !open;
    setOpen(status);
    if (toggleMenu) toggleMenu(item, status);
    return false;
  };
  const getActiveClass = useCallback(item => {
    return activeMenuItems?.includes(item.key) ? 'active' : '';
  }, [activeMenuItems]);
  return <li className={className}>
      <div onClick={toggleMenuItem} aria-expanded={open} role="button" className={clsx(linkClassName)}>
        {item.icon && <span className="nav-icon">
            <IconifyIcon icon={item.icon} />
          </span>}
        <span className="nav-text">{item.label}</span>
        {!item.badge ? <IconifyIcon icon="bx:chevron-down" className="menu-arrow" /> : <span className={`badge badge-pill text-end bg-${item.badge.variant}`}>{item.badge.text}</span>}
      </div>
      <Collapse in={open}>
        <div>
          <ul className={clsx(subMenuClassName)}>
            {(item.children || []).map((child, idx) => {
            return <Fragment key={child.key + idx}>
                  {child.children ? <MenuItemWithChildren item={child} linkClassName={clsx('nav-link', getActiveClass(child))} activeMenuItems={activeMenuItems} className="sub-nav-item" subMenuClassName="nav sub-navbar-nav" toggleMenu={toggleMenu} openGroups={openGroups} /> : <MenuItem item={child} className="sub-nav-item" linkClassName={clsx('sub-nav-link', getActiveClass(child))} />}
                </Fragment>;
          })}
          </ul>
        </div>
      </Collapse>
    </li>;
};
const MenuItem = ({
  item,
  className,
  linkClassName
}) => {
  return <li className={className}>
      <MenuItemLink item={item} className={linkClassName} />
    </li>;
};
const MenuItemLink = ({
  item,
  className
}) => {
  return <Link to={item.url ?? ''} target={item.target} className={clsx(className, {
    disabled: item.isDisabled
  })}>
      {item.icon && <span className="nav-icon">
          <IconifyIcon icon={item.icon} />
        </span>}
      <span className="nav-text">{item.label}</span>
      {item.badge && <span className={`badge badge-pill text-end bg-${item.badge.variant}`}>{item.badge.text}</span>}
    </Link>;
};
const AppMenu = ({
  menuItems
}) => {
  const {
    pathname
  } = useLocation();
  const { permissions, isAuthenticated } = useAuth();
  const [activeMenuItems, setActiveMenuItems] = useState([]);

  // Filter menu items based on user permissions
  const filteredMenuItems = useMemo(() => {
    if (!isAuthenticated || !permissions || !Array.isArray(permissions)) {
      return [];
    }
    try {
      return filterMenuByPermissions(menuItems, permissions);
    } catch (error) {
      console.error('Error filtering menu items:', error);
      return [];
    }
  }, [menuItems, permissions, isAuthenticated]);
  
  // localStorage persistence for open groups
  const STORAGE_KEY = 'sidebar.openGroups';
  
  const getOpenGroups = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to load sidebar state from localStorage:', error);
      return [];
    }
  };
  
  const saveOpenGroups = (openGroups) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch (error) {
      console.warn('Failed to save sidebar state to localStorage:', error);
    }
  };
  
  const [openGroups, setOpenGroups] = useState(getOpenGroups);
  
  const toggleMenu = (menuItem, show) => {
    console.log('Toggle menu:', menuItem.key, show); // Debug log
    // Update open groups for persistence - this is the primary function
    if (show) {
      const newOpenGroups = [...new Set([...openGroups, menuItem.key])];
      setOpenGroups(newOpenGroups);
      saveOpenGroups(newOpenGroups);
      console.log('Opening menu, new groups:', newOpenGroups); // Debug log
    } else {
      const newOpenGroups = openGroups.filter(key => key !== menuItem.key);
      setOpenGroups(newOpenGroups);
      saveOpenGroups(newOpenGroups);
      console.log('Closing menu, new groups:', newOpenGroups); // Debug log
    }
  };
  const getActiveClass = useCallback(item => {
    return activeMenuItems?.includes(item.key) ? 'active' : '';
  }, [activeMenuItems]);
  const activeMenu = useCallback(() => {
    const trimmedURL = pathname?.replaceAll('', '');
    const matchingMenuItem = getMenuItemFromURL(filteredMenuItems, trimmedURL);
    if (matchingMenuItem) {
      const activeMt = findMenuItem(menuItems, matchingMenuItem.key);
      if (activeMt) {
        const newActiveItems = [activeMt.key, ...findAllParent(menuItems, activeMt)];
        setActiveMenuItems(newActiveItems);
      }
      setTimeout(() => {
        const activatedItem = document.querySelector(`#leftside-menu-container .simplebar-content a[href="${trimmedURL}"]`);
        if (activatedItem) {
          const simplebarContent = document.querySelector('#leftside-menu-container .simplebar-content-wrapper');
          if (simplebarContent) {
            const offset = activatedItem.offsetTop - window.innerHeight * 0.4;
            scrollTo(simplebarContent, offset, 600);
          }
        }
      }, 400);

      // scrollTo (Left Side Bar Active Menu)
      const easeInOutQuad = (t, b, c, d) => {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
      };
      const scrollTo = (element, to, duration) => {
        const start = element.scrollTop,
          change = to - start,
          increment = 20;
        let currentTime = 0;
        const animateScroll = function () {
          currentTime += increment;
          const val = easeInOutQuad(currentTime, start, change, duration);
          element.scrollTop = val;
          if (currentTime < duration) {
            setTimeout(animateScroll, increment);
          }
        };
        animateScroll();
      };
    }
  }, [pathname, menuItems]);
  useEffect(() => {
    if (filteredMenuItems && filteredMenuItems.length > 0) activeMenu();
  }, [activeMenu, filteredMenuItems]);
  
  return <ul className="navbar-nav">
      {(filteredMenuItems || []).map((item, idx) => {
      return <Fragment key={item.key + idx}>
            {item.isTitle ? <li className="menu-title">{item.label}</li> : <>
                {item.children ? <MenuItemWithChildren item={item} toggleMenu={toggleMenu} className="nav-item" linkClassName={clsx('nav-link', getActiveClass(item))} subMenuClassName="nav sub-navbar-nav" activeMenuItems={activeMenuItems} openGroups={openGroups} /> : <MenuItem item={item} linkClassName={clsx('nav-link', getActiveClass(item))} className="nav-item" />}
              </>}
          </Fragment>;
    })}
    </ul>;
};
export default AppMenu;