import {describe,expect,it} from 'vitest';
import {projectInfo} from './project-info';
describe("Care Handoff Log project contract",()=>{it('keeps locale and direction aligned',()=>{expect(projectInfo.slug).toBe("care-handoff-log");expect(projectInfo.direction).toBe(projectInfo.locale==='fa-IR'?'rtl':'ltr');expect(projectInfo.firstTask.length).toBeGreaterThan(8);});});
