import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  
  {
    title: 'Intro & Get started',
    Svg: require('@site/static/img/undraw_start_building_re_xani.svg').default,
    description: (
      <>
        Installation etc
      </>
    ),
    action: 'Learn More',
    actionLink: '/msagljs/docs/intro'
  },
  {
    title: 'SVG and WebGL',
    Svg: require('@site/static/img/undraw_image_viewer_re_7ejc.svg').default,
    description: (
      <>
        SVG and WebGL renderers for MSAGL
      </>
    ),
    action: 'Learn More',
    actionLink: '/msagljs/docs/configuration'
  },
  {
    title: 'Interacting with the engine',
    Svg: require('@site/static/img/gear-svgrepo-com.svg').default,
    description: (
      <>
        Call the engine directly
      </>
    ),
    action: 'Learn More',
    actionLink: '/msagljs/docs/api'
  },
  
];

function Feature({ Svg, title, description, action, actionLink }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
        {action && actionLink && (
          <a href={actionLink} className="button button--primary">{action}</a>
        )}
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
