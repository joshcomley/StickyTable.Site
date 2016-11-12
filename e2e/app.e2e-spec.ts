import { StickyTableSitePage } from './app.po';

describe('sticky-table-site App', function() {
  let page: StickyTableSitePage;

  beforeEach(() => {
    page = new StickyTableSitePage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
