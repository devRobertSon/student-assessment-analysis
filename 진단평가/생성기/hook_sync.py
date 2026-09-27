# -*- coding: utf-8 -*-
"""자료 폴더의 파일을 고치면 저장소로 옮긴다. Claude Code 훅이 부른다.

훅이 건네는 JSON 을 읽어 고친 파일이 자료 폴더 안인지 보고, 맞으면
`sync.py --조용히` 를 돌린다. 자료 폴더가 없는 컴퓨터에서는 아무 말 없이
끝난다. 훅이 세션을 막지 않도록 무슨 일이 있어도 0 으로 끝난다.
"""
import json
import os
import sys

# 저장소 쪽 사본에서 돌 때 __pycache__ 를 만들지 않게 한다.
# 만들면 sync 가 그것을 군더더기로 보고 지워 매번 오갔다.
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def main():
    # 훅이 건네는 JSON 은 UTF-8 이다. 윈도에서 기본 인코딩으로 읽으면 한글 경로가
    # 깨져 자료 폴더 안인지 가릴 수 없다.
    try:
        받은것 = json.loads(sys.stdin.buffer.read().decode('utf-8', 'replace'))
    except Exception:
        return
    고친것 = (받은것.get('tool_input') or {}).get('file_path') or ''
    if not 고친것:
        return

    import 경로
    자료 = 경로.자료(조용히=True)
    if not 자료:
        return
    고친것 = os.path.abspath(고친것)
    if os.path.commonpath([고친것, 자료]) != 자료:
        return

    import sync
    sync.main(['--조용히'])


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    try:
        main()
    except Exception as e:
        # 훅이 일을 막으면 안 된다. 무엇이 걸렸는지만 적고 넘어간다.
        print('sync 훅을 건너뛴다: %s' % e)
    sys.exit(0)
